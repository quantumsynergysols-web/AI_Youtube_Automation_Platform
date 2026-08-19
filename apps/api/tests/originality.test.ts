import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuardVerdict } from '@prisma/client'

const prismaMock = {
  project: { findUnique: vi.fn() },
  channelVideo: { findMany: vi.fn() },
  publication: { count: vi.fn() },
  originalityCheck: { upsert: vi.fn(), findUnique: vi.fn() },
}
vi.mock('../src/lib/prisma', () => ({ prisma: prismaMock }))

const { runOriginalityCheck, assertPublishable, THRESHOLDS } = await import(
  '../src/modules/originality/originality.service'
)

const GOOD_COMMENTARY =
  'I have tried this workflow on my own channel for three months and the retention ' +
  'difference only shows up on videos longer than eight minutes, which nobody mentions.'

function project(overrides: { script?: Record<string, unknown>; channelId?: string | null } = {}) {
  return {
    id: 'project-1',
    channelId: overrides.channelId === undefined ? 'channel-1' : overrides.channelId,
    script: {
      hook: 'Three keyboard shortcuts that changed how I edit',
      beats: ['shortcut one saves time', 'shortcut two avoids the mouse'],
      commentary: GOOD_COMMENTARY,
      hookEditedAt: new Date(),
      humanInputMs: 45_000,
      ...(overrides.script ?? {}),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.publication.count.mockResolvedValue(0)
  prismaMock.channelVideo.findMany.mockResolvedValue([])
  prismaMock.originalityCheck.upsert.mockResolvedValue({})
})

describe('runOriginalityCheck — passing', () => {
  it('passes a script with new material, commentary and an edited hook', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())

    const result = await runOriginalityCheck('project-1')

    expect(result.verdict).toBe(GuardVerdict.PASS)
    expect(result.reason).toBeNull()
    expect(result.score).toBeGreaterThan(0.9)
    expect(result.hasCommentary).toBe(true)
    expect(result.hookEdited).toBe(true)
  })

  it('does not block a creator with no back catalogue', async () => {
    // A first-ever video has nothing to duplicate. Blocking it would be absurd,
    // and an average-based similarity score could still have produced one.
    prismaMock.project.findUnique.mockResolvedValue(project())
    prismaMock.channelVideo.findMany.mockResolvedValue([])

    const result = await runOriginalityCheck('project-1')
    expect(result.verdict).toBe(GuardVerdict.PASS)
    expect(result.similarity).toBe(0)
    expect(result.duplicateOf).toBeNull()
  })

  it('always requires the altered-content disclosure (FR-9.5)', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    const result = await runOriginalityCheck('project-1')
    expect(result.requiresDisclosure).toBe(true)
  })
})

describe('runOriginalityCheck — blocking on duplication (FR-9.2)', () => {
  it('blocks a near-duplicate of an existing video and names it', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    prismaMock.channelVideo.findMany.mockResolvedValue([
      {
        youtubeVideoId: 'abc123',
        title: 'Three keyboard shortcuts that changed how I edit',
        description: 'shortcut one saves time shortcut two avoids the mouse',
      },
    ])

    const result = await runOriginalityCheck('project-1')

    expect(result.verdict).toBe(GuardVerdict.BLOCKED)
    expect(result.similarity).toBeGreaterThanOrEqual(THRESHOLDS.DUPLICATE_THRESHOLD)
    expect(result.duplicateOf).toBe('abc123')
    expect(result.reason).toContain('abc123')
  })

  it('allows a genuinely different take on a topic already covered', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    prismaMock.channelVideo.findMany.mockResolvedValue([
      {
        youtubeVideoId: 'old1',
        title: 'My honest review of the new camera after six months',
        description: 'low light performance, autofocus, battery life in the cold',
      },
    ])

    const result = await runOriginalityCheck('project-1')
    expect(result.verdict).toBe(GuardVerdict.PASS)
    expect(result.similarity).toBeLessThan(THRESHOLDS.DUPLICATE_THRESHOLD)
  })

  it('does not name a match too weak to be worth mentioning', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    prismaMock.channelVideo.findMany.mockResolvedValue([
      { youtubeVideoId: 'weak1', title: 'Completely unrelated gardening video', description: '' },
    ])

    const result = await runOriginalityCheck('project-1')
    expect(result.similarity).toBeLessThan(THRESHOLDS.MENTION_THRESHOLD)
    expect(result.duplicateOf).toBeNull()
  })
})

describe('runOriginalityCheck — blocking on missing human input (FR-9.3)', () => {
  it('blocks when there is no commentary at all', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project({ script: { commentary: null } }))

    const result = await runOriginalityCheck('project-1')

    expect(result.verdict).toBe(GuardVerdict.BLOCKED)
    expect(result.hasCommentary).toBe(false)
    expect(result.reason).toMatch(/own commentary/i)
  })

  it('blocks commentary too short to carry a point of view', async () => {
    // Guards against the requirement becoming theatre — typing "yes" must not satisfy it.
    prismaMock.project.findUnique.mockResolvedValue(
      project({ script: { commentary: 'Good video, I agree with this.' } }),
    )

    const result = await runOriginalityCheck('project-1')

    expect(result.verdict).toBe(GuardVerdict.BLOCKED)
    expect(result.reason).toContain(String(THRESHOLDS.MIN_COMMENTARY_WORDS))
  })

  it('blocks when the hook was never edited by a human', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project({ script: { hookEditedAt: null } }))

    const result = await runOriginalityCheck('project-1')

    expect(result.verdict).toBe(GuardVerdict.BLOCKED)
    expect(result.hookEdited).toBe(false)
    expect(result.reason).toMatch(/hook/i)
  })

  it('reports duplication first when several problems apply at once', async () => {
    // The most expensive problem to fix should be the one surfaced first.
    prismaMock.project.findUnique.mockResolvedValue(
      project({ script: { commentary: null, hookEditedAt: null } }),
    )
    prismaMock.channelVideo.findMany.mockResolvedValue([
      {
        youtubeVideoId: 'dup1',
        title: 'Three keyboard shortcuts that changed how I edit',
        description: 'shortcut one saves time shortcut two avoids the mouse',
      },
    ])

    const result = await runOriginalityCheck('project-1')
    expect(result.reason).toContain('dup1')
  })
})

describe('runOriginalityCheck — score and audit trail (FR-9.6)', () => {
  it('lowers the score for each missing signal rather than only pass or fail', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    const good = await runOriginalityCheck('project-1')

    prismaMock.project.findUnique.mockResolvedValue(
      project({ script: { commentary: null, hookEditedAt: null } }),
    )
    const poor = await runOriginalityCheck('project-1')

    expect(poor.score).toBeLessThan(good.score)
  })

  it('records the human input time for appeal evidence', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project({ script: { humanInputMs: 92_000 } }))
    const result = await runOriginalityCheck('project-1')
    expect(result.humanInputMs).toBe(92_000)
  })

  it('persists the full breakdown, not just the verdict', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    await runOriginalityCheck('project-1')

    const written = prismaMock.originalityCheck.upsert.mock.calls[0]![0] as {
      create: Record<string, unknown>
    }
    for (const field of ['verdict', 'score', 'similarity', 'hookEdited', 'hasCommentary', 'requiresDisclosure']) {
      expect(written.create).toHaveProperty(field)
    }
  })
})

describe('runOriginalityCheck — cadence warnings (FR-9.4)', () => {
  it('warns but does not block when publishing fast', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    prismaMock.publication.count.mockResolvedValue(THRESHOLDS.MAX_PER_DAY + 1)

    const result = await runOriginalityCheck('project-1')

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/24 hours/)
    expect(result.verdict).toBe(GuardVerdict.PASS)
  })

  it('produces no warnings for a normal cadence', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project())
    prismaMock.publication.count.mockResolvedValue(1)

    const result = await runOriginalityCheck('project-1')
    expect(result.warnings).toEqual([])
  })

  it('skips the cadence check when the project has no channel', async () => {
    prismaMock.project.findUnique.mockResolvedValue(project({ channelId: null }))
    const result = await runOriginalityCheck('project-1')
    expect(result.warnings).toEqual([])
    expect(prismaMock.publication.count).not.toHaveBeenCalled()
  })
})

describe('runOriginalityCheck — preconditions', () => {
  it('rejects a project that does not exist', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null)
    await expect(runOriginalityCheck('nope')).rejects.toMatchObject({ status: 404 })
  })

  it('rejects a project with no script yet', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'p', channelId: null, script: null })
    await expect(runOriginalityCheck('p')).rejects.toMatchObject({ status: 400 })
  })
})

describe('assertPublishable — the gate', () => {
  it('refuses when no check has been run', async () => {
    // Fails CLOSED. Failing open would make the guard bypassable by never running it.
    prismaMock.originalityCheck.findUnique.mockResolvedValue(null)
    await expect(assertPublishable('project-1')).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a blocked project and repeats the reason', async () => {
    prismaMock.originalityCheck.findUnique.mockResolvedValue({
      verdict: GuardVerdict.BLOCKED,
      reason: 'This script closely resembles a video already on the channel (abc123).',
    })
    await expect(assertPublishable('project-1')).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('abc123'),
    })
  })

  it('allows a passed project', async () => {
    prismaMock.originalityCheck.findUnique.mockResolvedValue({
      verdict: GuardVerdict.PASS,
      reason: null,
    })
    await expect(assertPublishable('project-1')).resolves.toBeUndefined()
  })
})
