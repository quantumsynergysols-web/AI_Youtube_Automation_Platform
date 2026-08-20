import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Plan, ProjectState, SubscriptionStatus } from '@prisma/client'

const prismaMock = {
  project: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  channel: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn() },
}
vi.mock('../src/lib/prisma', () => ({ prisma: prismaMock }))

const { createProject, listProjects, getProject, updateProject, deleteProject, PROJECT_RULES } =
  await import('../src/modules/projects/projects.service')
const { ALL_PLANS } = await import('../src/config/plans')

const OWNER = 'user-1'

function onPlan(plan: Plan) {
  prismaMock.subscription.findUnique.mockResolvedValue({
    userId: OWNER,
    plan,
    status: SubscriptionStatus.ACTIVE,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  onPlan(Plan.FREE)
  prismaMock.project.create.mockImplementation(async ({ data }: never) => ({ id: 'project-1', ...data }))
  prismaMock.project.update.mockImplementation(async ({ data }: never) => ({ id: 'project-1', ...data }))
  prismaMock.project.delete.mockResolvedValue({})
})

describe('createProject', () => {
  it('creates a DRAFT project with sensible defaults', async () => {
    const project = await createProject(OWNER, { topic: 'editing faster' })
    expect(project.state).toBe(ProjectState.DRAFT)
    expect(project.targetDurationSec).toBe(60)
    expect(project.language).toBe('en')
  })

  it('trims the topic and rejects a blank one', async () => {
    const project = await createProject(OWNER, { topic: '  editing faster  ' })
    expect(project.topic).toBe('editing faster')
    await expect(createProject(OWNER, { topic: '   ' })).rejects.toMatchObject({ status: 400 })
  })

  it('refuses a duration over the cap, rather than clamping it', async () => {
    // Silently shortening a ten-minute request to ninety seconds would read as
    // the product being broken, so the limit is stated instead.
    await expect(createProject(OWNER, { topic: 't', targetDurationSec: 600 })).rejects.toMatchObject({
      status: 403,
    })
    expect(prismaMock.project.create).not.toHaveBeenCalled()
  })

  it('does not promise an upgrade that would not help', async () => {
    // Every tier caps duration at the same value — plans differ on videos per
    // month and channel count. Telling someone to upgrade for a longer video
    // would send them to the billing page to buy something that does not exist.
    await expect(createProject(OWNER, { topic: 't', targetDurationSec: 600 })).rejects.toThrow(
      /capped at \d+ seconds on every plan/i,
    )
    await expect(
      createProject(OWNER, { topic: 't', targetDurationSec: 600 }),
    ).rejects.not.toThrow(/upgrade/i)
  })

  it('accepts a video exactly at the cap', async () => {
    const atCap = Math.max(...ALL_PLANS.map((p) => p.maxDurationSec))
    const project = await createProject(OWNER, { topic: 't', targetDurationSec: atCap })
    expect(project.targetDurationSec).toBe(atCap)
  })

  it('rejects a video too short to be a video', async () => {
    await expect(
      createProject(OWNER, { topic: 't', targetDurationSec: PROJECT_RULES.MIN_DURATION_SEC - 1 }),
    ).rejects.toMatchObject({ status: 400 })
  })


  it("refuses to attach someone else's channel", async () => {
    // The scriptwriter feeds the attached channel's video titles into the prompt
    // as covered ground, so an unchecked id would read a competitor's back
    // catalogue back out of a generated script.
    prismaMock.channel.findUnique.mockResolvedValue({ userId: 'someone-else' })
    await expect(
      createProject(OWNER, { topic: 't', channelId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toMatchObject({ status: 404 })
    expect(prismaMock.project.create).not.toHaveBeenCalled()
  })

  it('attaches a channel the caller owns', async () => {
    prismaMock.channel.findUnique.mockResolvedValue({ userId: OWNER })
    const project = await createProject(OWNER, {
      topic: 't',
      channelId: '11111111-1111-1111-1111-111111111111',
    })
    expect(project.channelId).toBe('11111111-1111-1111-1111-111111111111')
  })
})

describe('listProjects', () => {
  it('returns a page and a cursor when more remain', async () => {
    prismaMock.project.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({ id: `p${i}` })),
    )
    const result = await listProjects(OWNER, { limit: 20 })
    expect(result.projects).toHaveLength(20)
    expect(result.nextCursor).toBe('p19')
  })

  it('returns no cursor on the last page', async () => {
    prismaMock.project.findMany.mockResolvedValue([{ id: 'p0' }, { id: 'p1' }])
    const result = await listProjects(OWNER, { limit: 20 })
    expect(result.nextCursor).toBeNull()
  })

  it('scopes the query to the caller', async () => {
    prismaMock.project.findMany.mockResolvedValue([])
    await listProjects(OWNER)
    expect(prismaMock.project.findMany.mock.calls[0]![0].where.userId).toBe(OWNER)
  })
})

describe('getProject', () => {
  it('returns the caller own project', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', userId: OWNER })
    await expect(getProject(OWNER, 'project-1')).resolves.toMatchObject({ id: 'project-1' })
  })

  it("answers 404 for someone else's project rather than 403", async () => {
    // 403 would confirm the id exists to a stranger who guessed it.
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', userId: 'someone-else' })
    await expect(getProject(OWNER, 'project-1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('updateProject', () => {
  function inState(state: ProjectState) {
    prismaMock.project.findUnique.mockResolvedValue({ userId: OWNER, state })
  }

  it('edits the brief while the project is still a draft', async () => {
    inState(ProjectState.DRAFT)
    const project = await updateProject(OWNER, 'project-1', { topic: 'a sharper topic' })
    expect(project.topic).toBe('a sharper topic')
  })

  it('refuses to edit the brief once rendering has started', async () => {
    // The record is appeal evidence for the guard, so it has to keep describing
    // what was actually produced.
    inState(ProjectState.RENDERING)
    await expect(updateProject(OWNER, 'project-1', { topic: 'x' })).rejects.toMatchObject({
      status: 400,
    })
  })

  it('still allows edits after a block, which is the whole point of blocking', async () => {
    inState(ProjectState.BLOCKED)
    await expect(updateProject(OWNER, 'project-1', { topic: 'a new angle' })).resolves.toBeTruthy()
  })

  it('re-checks the plan limit on a duration change', async () => {
    inState(ProjectState.DRAFT)
    onPlan(Plan.FREE)
    await expect(
      updateProject(OWNER, 'project-1', { targetDurationSec: 3600 }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it("refuses to move a project onto someone else's channel", async () => {
    inState(ProjectState.DRAFT)
    prismaMock.channel.findUnique.mockResolvedValue({ userId: 'someone-else' })
    await expect(
      updateProject(OWNER, 'project-1', { channelId: '11111111-1111-1111-1111-111111111111' }),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('detaches the channel when given null', async () => {
    inState(ProjectState.DRAFT)
    await updateProject(OWNER, 'project-1', { channelId: null })
    expect(prismaMock.project.update.mock.calls[0]![0].data.channel).toEqual({ disconnect: true })
  })

  it('rejects an empty patch', async () => {
    inState(ProjectState.DRAFT)
    await expect(updateProject(OWNER, 'project-1', {})).rejects.toMatchObject({ status: 400 })
  })
})

describe('deleteProject', () => {
  it('deletes a draft', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ userId: OWNER, state: ProjectState.DRAFT })
    await expect(deleteProject(OWNER, 'project-1')).resolves.toBeUndefined()
    expect(prismaMock.project.delete).toHaveBeenCalledOnce()
  })

  it('refuses while work is in flight, which deleting would strand', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ userId: OWNER, state: ProjectState.RENDERING })
    await expect(deleteProject(OWNER, 'project-1')).rejects.toMatchObject({ status: 400 })
    expect(prismaMock.project.delete).not.toHaveBeenCalled()
  })

  it('deletes a published project, which is finished work the creator may remove', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ userId: OWNER, state: ProjectState.PUBLISHED })
    await expect(deleteProject(OWNER, 'project-1')).resolves.toBeUndefined()
  })

  it("refuses to delete someone else's project", async () => {
    prismaMock.project.findUnique.mockResolvedValue({ userId: 'someone-else', state: ProjectState.DRAFT })
    await expect(deleteProject(OWNER, 'project-1')).rejects.toMatchObject({ status: 404 })
  })
})
