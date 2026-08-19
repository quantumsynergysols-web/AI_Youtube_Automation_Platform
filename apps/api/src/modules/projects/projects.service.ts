import { Prisma, ProjectState } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { ALL_PLANS, planDefinition } from '../../config/plans'
import { subscriptionFor } from '../billing/billing.service'

/**
 * Projects — the unit a video is made from.
 *
 * Everything in Phase 2 hangs off a project: the scriptwriter (FR-4), the
 * render stages, the Originality Guard (FR-9) and publishing (FR-10) all
 * address one by id.
 */

/** Floor on a usable video. Shorter than this is not a video, it is a sting. */
const MIN_DURATION_SEC = 15

/**
 * States where the brief can still be changed.
 *
 * Once rendering starts, the topic and duration on the record are what the
 * media was produced from. Editing them afterwards would leave a project whose
 * description no longer matches its own output — and the Originality Guard
 * reads that record as appeal evidence, so it has to stay true.
 */
const EDITABLE_STATES: ProjectState[] = [
  ProjectState.DRAFT,
  ProjectState.AWAITING_APPROVAL,
  ProjectState.BLOCKED,
  ProjectState.FAILED,
]

/** States where work is in flight and deleting would strand it. */
const BUSY_STATES: ProjectState[] = [
  ProjectState.SCRIPTING,
  ProjectState.RENDERING,
  ProjectState.CHECKING,
  ProjectState.PUBLISHING,
]

export interface CreateProjectInput {
  topic: string
  targetDurationSec?: number
  language?: string
  style?: string | null
  channelId?: string | null
}

/**
 * Confirms the channel belongs to the caller.
 *
 * Not merely an ownership formality: the scriptwriter feeds this channel's
 * video titles into the prompt as covered ground, so an unchecked id would let
 * anyone read a competitor's back catalogue back out of a generated script.
 */
async function assertOwnsChannel(userId: string, channelId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { userId: true },
  })
  if (!channel || channel.userId !== userId) throw notFound('No such channel.')
}

/**
 * Checks the requested duration against what the plan allows.
 *
 * Refuses rather than silently clamping. A creator who asked for three minutes
 * and got ninety seconds without being told would reasonably read that as the
 * product being broken.
 *
 * Only suggests upgrading when upgrading would actually help. Today every tier
 * caps at the same duration — the plans differ on videos per month and channel
 * count — so a blanket "upgrade for longer videos" would send someone to the
 * billing page to buy something that does not exist. Derived from the plan file
 * rather than hardcoded, so it stays honest if the tiers ever diverge.
 */
async function assertDurationAllowed(userId: string, seconds: number): Promise<void> {
  if (seconds < MIN_DURATION_SEC) {
    throw badRequest(`Videos must be at least ${MIN_DURATION_SEC} seconds.`)
  }

  const sub = await subscriptionFor(userId)
  const def = planDefinition(sub.plan)
  if (seconds <= def.maxDurationSec) return

  const longestAvailable = Math.max(...ALL_PLANS.map((p) => p.maxDurationSec))
  throw forbidden(
    longestAvailable > def.maxDurationSec
      ? `Your ${def.name} plan allows videos up to ${def.maxDurationSec} seconds. ` +
          `Shorten this video, or upgrade to make one up to ${longestAvailable} seconds.`
      : `Videos are capped at ${def.maxDurationSec} seconds on every plan. ` +
          `Shorten this video to ${def.maxDurationSec} seconds or less.`,
  )
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const topic = input.topic.trim()
  if (!topic) throw badRequest('Give the video a topic.')

  const targetDurationSec = input.targetDurationSec ?? 60
  await assertDurationAllowed(userId, targetDurationSec)
  if (input.channelId) await assertOwnsChannel(userId, input.channelId)

  const project = await prisma.project.create({
    data: {
      userId,
      topic,
      targetDurationSec,
      language: input.language ?? 'en',
      style: input.style?.trim() || null,
      channelId: input.channelId ?? null,
      state: ProjectState.DRAFT,
    },
  })

  logger.info({ userId, projectId: project.id, targetDurationSec }, 'project created')
  return project
}

export interface ListOptions {
  state?: ProjectState
  limit?: number
  /** id of the last project on the previous page. */
  cursor?: string
}

export async function listProjects(userId: string, opts: ListOptions = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100)

  const projects = await prisma.project.findMany({
    where: { userId, ...(opts.state ? { state: opts.state } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // one extra, to know whether another page exists
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    include: {
      channel: { select: { id: true, title: true } },
      script: { select: { wordCount: true, hookEditedAt: true, commentaryAddedAt: true } },
      originalityCheck: { select: { verdict: true, score: true } },
    },
  })

  const page = projects.slice(0, limit)
  return {
    projects: page,
    nextCursor: projects.length > limit ? (page.at(-1)?.id ?? null) : null,
  }
}

export async function getProject(userId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      channel: { select: { id: true, title: true } },
      script: { include: { scenes: { orderBy: { ordinal: 'asc' } } } },
      originalityCheck: true,
      publication: true,
    },
  })
  // Same id-does-not-exist answer for someone else's project, so the endpoint
  // does not confirm it exists to a stranger holding a guessed id.
  if (!project || project.userId !== userId) throw notFound('No such project.')
  return project
}

export interface UpdateProjectInput {
  topic?: string
  targetDurationSec?: number
  language?: string
  style?: string | null
  channelId?: string | null
}

export async function updateProject(userId: string, projectId: string, patch: UpdateProjectInput) {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, state: true },
  })
  if (!existing || existing.userId !== userId) throw notFound('No such project.')

  if (!EDITABLE_STATES.includes(existing.state)) {
    throw badRequest(
      `This project is ${existing.state.toLowerCase().replace(/_/g, ' ')} and its brief can no longer be changed.`,
    )
  }

  const data: Prisma.ProjectUpdateInput = {}

  if (patch.topic !== undefined) {
    const topic = patch.topic.trim()
    if (!topic) throw badRequest('Give the video a topic.')
    data.topic = topic
  }
  if (patch.targetDurationSec !== undefined) {
    await assertDurationAllowed(userId, patch.targetDurationSec)
    data.targetDurationSec = patch.targetDurationSec
  }
  if (patch.language !== undefined) data.language = patch.language
  if (patch.style !== undefined) data.style = patch.style?.trim() || null
  if (patch.channelId !== undefined) {
    if (patch.channelId) {
      await assertOwnsChannel(userId, patch.channelId)
      data.channel = { connect: { id: patch.channelId } }
    } else {
      data.channel = { disconnect: true }
    }
  }

  if (Object.keys(data).length === 0) throw badRequest('Nothing to update.')

  const project = await prisma.project.update({ where: { id: projectId }, data })
  logger.info({ userId, projectId, fields: Object.keys(data) }, 'project updated')
  return project
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const existing = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, state: true },
  })
  if (!existing || existing.userId !== userId) throw notFound('No such project.')

  if (BUSY_STATES.includes(existing.state)) {
    throw badRequest(
      'This project is still being worked on. Wait for it to finish, or cancel it first.',
    )
  }

  // Script, scenes, jobs, assets and the guard result are all cascaded by the
  // schema, so this does not leave orphans behind.
  await prisma.project.delete({ where: { id: projectId } })
  logger.info({ userId, projectId }, 'project deleted')
}

export const PROJECT_RULES = { MIN_DURATION_SEC, EDITABLE_STATES, BUSY_STATES } as const
