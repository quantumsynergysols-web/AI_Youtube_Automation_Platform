import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectState, SceneRole } from '@prisma/client'

const prismaMock = {
  project: { findUnique: vi.fn(), update: vi.fn() },
  channelVideo: { findMany: vi.fn() },
  script: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  scene: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}
vi.mock('../src/lib/prisma', () => ({ prisma: prismaMock }))

const { generateScript, applyHumanEdits, orderScenes, validateDraft } = await import(
  '../src/modules/generation/script.service'
)
const { LlmShapeError } = await import('../src/modules/generation/providers/llm')
const { buildScriptPrompt } = await import('../src/modules/generation/script.prompt')
import type { LlmProvider } from '../src/modules/generation/providers/llm'
import type { ScriptDraft } from '../src/modules/generation/script.schema'

function scene(role: SceneRole, narration: string, seconds = 6) {
  return {
    role,
    narration,
    visualPrompt: `a still frame for ${narration}`,
    estimatedSeconds: seconds,
  }
}

function draft(overrides: Partial<ScriptDraft> = {}): ScriptDraft {
  return {
    title: 'Three shortcuts that actually save time',
    artDirection:
      'A cluttered home edit bay at dusk. Warm tungsten key from screen-left, deep teal shadows, 35mm, shallow depth of field, visible dust.',
    scenes: [
      scene(SceneRole.HOOK, 'You are not slow because you are careless.'),
      scene(SceneRole.INTRODUCTION, 'Most editing advice fixes the wrong bottleneck.'),
      scene(SceneRole.BODY, 'The first shortcut removes the mouse from trimming entirely.'),
      scene(SceneRole.CALL_TO_ACTION, 'Try it on one timeline this week.'),
    ],
    ...overrides,
  }
}

/** A provider that returns whatever it is handed, so no network is involved. */
function fakeProvider(data: ScriptDraft | (() => never)): LlmProvider {
  return {
    name: 'fake',
    generate: vi.fn(async () => {
      if (typeof data === 'function') data()
      return {
        data,
        usage: { inputTokens: 1200, outputTokens: 800, cachedInputTokens: 0 },
        model: 'fake-model',
        latencyMs: 10,
      }
    }),
  } as unknown as LlmProvider
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.project.findUnique.mockResolvedValue({
    id: 'project-1',
    channelId: 'channel-1',
    topic: 'editing faster',
    targetDurationSec: 60,
    language: 'en',
    style: null,
    channel: { title: 'Test Channel' },
  })
  prismaMock.project.update.mockResolvedValue({})
  prismaMock.channelVideo.findMany.mockResolvedValue([])
  prismaMock.script.upsert.mockResolvedValue({ id: 'script-1' })
  prismaMock.scene.deleteMany.mockResolvedValue({})
  prismaMock.scene.createMany.mockResolvedValue({})
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prismaMock))
})

describe('orderScenes', () => {
  it('puts the hook first and the call to action last', () => {
    const out = orderScenes([
      scene(SceneRole.CALL_TO_ACTION, 'cta'),
      scene(SceneRole.BODY, 'body'),
      scene(SceneRole.HOOK, 'hook'),
    ])
    expect(out.map((s) => s.role)).toEqual([SceneRole.HOOK, SceneRole.BODY, SceneRole.CALL_TO_ACTION])
  })

  it('preserves the order of body scenes, which carry the argument', () => {
    const out = orderScenes([
      scene(SceneRole.BODY, 'first point'),
      scene(SceneRole.BODY, 'second point'),
      scene(SceneRole.BODY, 'third point'),
      scene(SceneRole.HOOK, 'hook'),
    ])
    expect(out.slice(1).map((s) => s.narration)).toEqual(['first point', 'second point', 'third point'])
  })

  it('never drops a scene', () => {
    const input = [
      scene(SceneRole.BODY, 'a'),
      scene(SceneRole.CALL_TO_ACTION, 'b'),
      scene(SceneRole.HOOK, 'c'),
      scene(SceneRole.INTRODUCTION, 'd'),
    ]
    expect(orderScenes(input)).toHaveLength(input.length)
  })
})

describe('validateDraft', () => {
  it('accepts a well-formed draft', () => {
    expect(() => validateDraft(draft())).not.toThrow()
  })

  it('rejects a draft with no hook', () => {
    const d = draft({ scenes: [scene(SceneRole.BODY, 'a'), scene(SceneRole.CALL_TO_ACTION, 'b')] })
    expect(() => validateDraft(d)).toThrow(/without a hook/i)
  })

  it('rejects a one-scene draft', () => {
    expect(() => validateDraft(draft({ scenes: [scene(SceneRole.HOOK, 'only')] }))).toThrow(/at least 2/i)
  })

  it('rejects a draft with no art direction, which would let visuals drift', () => {
    expect(() => validateDraft(draft({ artDirection: '   ' }))).toThrow(/art direction/i)
  })

  it('names the scene that came back blank', () => {
    const scenes = draft().scenes
    scenes[2]!.visualPrompt = ''
    expect(() => validateDraft(draft({ scenes }))).toThrow(/Scene 3/)
  })
})

describe('buildScriptPrompt', () => {
  it('hands the back catalogue over as covered ground', () => {
    const prompt = buildScriptPrompt({
      topic: 'editing faster',
      targetDurationSec: 60,
      language: 'en',
      channelTitle: 'Test Channel',
      recentVideoTitles: ['How I edit faster', 'My camera review'],
    })
    expect(prompt).toContain('How I edit faster')
    expect(prompt).toContain('My camera review')
    expect(prompt).toMatch(/covered ground/i)
  })

  it('says so explicitly when there is no catalogue, rather than leaving a blank list', () => {
    // An empty "avoid these" list reads as "avoid nothing in particular", which
    // is a weaker instruction than stating there is nothing to avoid.
    const prompt = buildScriptPrompt({
      topic: 'editing faster',
      targetDurationSec: 60,
      language: 'en',
      recentVideoTitles: [],
    })
    expect(prompt).toMatch(/no imported back catalogue/i)
  })

  it('scales the word target to the requested duration', () => {
    const short = buildScriptPrompt({ topic: 't', targetDurationSec: 30, language: 'en', recentVideoTitles: [] })
    const long = buildScriptPrompt({ topic: 't', targetDurationSec: 180, language: 'en', recentVideoTitles: [] })
    expect(short).toContain('about 75 words')
    expect(long).toContain('about 450 words')
  })
})

describe('generateScript', () => {
  it('persists the hook, art direction and scenes', async () => {
    const result = await generateScript('project-1', fakeProvider(draft()))

    expect(result.hook).toBe('You are not slow because you are careless.')
    expect(result.scenes).toHaveLength(4)
    expect(result.scenes[0]!.role).toBe(SceneRole.HOOK)
    expect(prismaMock.scene.createMany).toHaveBeenCalledOnce()
  })

  it('keeps image prompts and the hook out of beats, which FR-9 scores', async () => {
    // beats is concatenated with hook to measure similarity. Image prompts in
    // there would score the video against text nobody ever hears, and a
    // repeated hook would double-count the one line most likely to be reused.
    await generateScript('project-1', fakeProvider(draft()))

    const beats = prismaMock.script.upsert.mock.calls[0]![0].create.beats as string[]
    expect(beats).not.toContain('You are not slow because you are careless.')
    expect(beats.some((b) => b.includes('a still frame for'))).toBe(false)
    expect(beats).toContain('Most editing advice fixes the wrong bottleneck.')
  })

  it('clears hookEditedAt on regeneration but keeps the creator commentary', async () => {
    // A regenerated hook has not been reviewed by anyone. Leaving the timestamp
    // set would let it satisfy FR-9's human-input rule unread — the exact hole
    // the guard exists to close. Commentary is the creator's own writing.
    await generateScript('project-1', fakeProvider(draft()))

    const update = prismaMock.script.upsert.mock.calls[0]![0].update
    expect(update.hookEditedAt).toBeNull()
    expect(update).not.toHaveProperty('commentary')
  })

  it('lays scenes on a contiguous timeline', async () => {
    const result = await generateScript('project-1', fakeProvider(draft()))
    for (let i = 1; i < result.scenes.length; i++) {
      expect(result.scenes[i]!.startMs).toBe(result.scenes[i - 1]!.endMs)
    }
    expect(result.estimatedDurationSec).toBe(24)
  })

  it('moves the project to AWAITING_APPROVAL so a human reviews before rendering', async () => {
    await generateScript('project-1', fakeProvider(draft()))
    const states = prismaMock.project.update.mock.calls.map((c) => c[0].data.state)
    expect(states).toContain(ProjectState.SCRIPTING)
    expect(states).toContain(ProjectState.AWAITING_APPROVAL)
  })

  it('returns the project to DRAFT when generation fails, not FAILED', async () => {
    // Nothing is broken and no operator action is needed — the creator can just
    // ask again, so the project must not be left looking wedged.
    const boom = fakeProvider(() => {
      throw new LlmShapeError('bad output')
    })
    await expect(generateScript('project-1', boom)).rejects.toThrow(LlmShapeError)

    const last = prismaMock.project.update.mock.calls.at(-1)![0]
    expect(last.data.state).toBe(ProjectState.DRAFT)
  })

  it('rejects a project that does not exist', async () => {
    prismaMock.project.findUnique.mockResolvedValue(null)
    await expect(generateScript('nope', fakeProvider(draft()))).rejects.toMatchObject({ status: 404 })
  })

  it('skips the catalogue lookup for a project with no channel', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      channelId: null,
      topic: 't',
      targetDurationSec: 60,
      language: 'en',
      style: null,
      channel: null,
    })
    await generateScript('project-1', fakeProvider(draft()))
    expect(prismaMock.channelVideo.findMany).not.toHaveBeenCalled()
  })
})

describe('applyHumanEdits (FR-4.5)', () => {
  beforeEach(() => {
    prismaMock.script.findUnique.mockResolvedValue({ id: 'script-1', hook: 'the generated hook' })
    prismaMock.script.update.mockResolvedValue({})
  })

  it('records the hook as edited when it actually changed', async () => {
    await applyHumanEdits('project-1', { hook: 'a sharper hook the creator wrote' })
    const data = prismaMock.script.update.mock.calls[0]![0].data
    expect(data.hookEditedAt).toBeInstanceOf(Date)
  })

  it('does not record an edit when the generated hook was saved untouched', async () => {
    // Otherwise opening the editor and pressing save satisfies the guard with
    // one click, which makes the human-input requirement theatre.
    await applyHumanEdits('project-1', { hook: 'the generated hook' })
    const data = prismaMock.script.update.mock.calls[0]![0].data
    expect(data.hookEditedAt).toBeUndefined()
    expect(data.hook).toBe('the generated hook')
  })

  it('ignores surrounding whitespace when deciding the hook changed', async () => {
    await applyHumanEdits('project-1', { hook: '  the generated hook  ' })
    expect(prismaMock.script.update.mock.calls[0]![0].data.hookEditedAt).toBeUndefined()
  })

  it('rejects an empty hook', async () => {
    await expect(applyHumanEdits('project-1', { hook: '   ' })).rejects.toMatchObject({ status: 400 })
  })

  it('timestamps commentary when added and clears it when emptied', async () => {
    await applyHumanEdits('project-1', { commentary: 'What nobody says about this is...' })
    expect(prismaMock.script.update.mock.calls[0]![0].data.commentaryAddedAt).toBeInstanceOf(Date)

    vi.clearAllMocks()
    prismaMock.script.findUnique.mockResolvedValue({ id: 'script-1', hook: 'h' })
    await applyHumanEdits('project-1', { commentary: '  ' })
    const data = prismaMock.script.update.mock.calls[0]![0].data
    expect(data.commentary).toBeNull()
    expect(data.commentaryAddedAt).toBeNull()
  })

  it('accumulates human input time rather than overwriting it', async () => {
    // The field is evidence for a strike appeal, so a later short edit must not
    // erase the record of a long one.
    await applyHumanEdits('project-1', { humanInputMs: 45_000 })
    expect(prismaMock.script.update.mock.calls[0]![0].data.humanInputMs).toEqual({ increment: 45_000 })
  })

  it('rejects an edit to a project with no script yet', async () => {
    prismaMock.script.findUnique.mockResolvedValue(null)
    await expect(applyHumanEdits('project-1', { hook: 'x' })).rejects.toMatchObject({ status: 404 })
  })
})
