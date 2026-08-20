import { GuardBlockReason, GuardVerdict } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { badRequest, forbidden, notFound } from '../../lib/errors'
import { closestMatch, tokenise } from './similarity'

/**
 * The Originality Guard (FR-9).
 *
 * This is the product, not a compliance checkbox. Every competitor sells output
 * volume, which is what YouTube's Inauthentic Content policy now demonetises at
 * channel level. The guard is what lets a creator publish more without becoming
 * the thing that policy targets — so it blocks rather than warns, and the
 * blocking rules are deliberately not configurable by the customer.
 */

/**
 * Similarity at or above this blocks publishing.
 *
 * 0.55 on max(jaccard, containment) over word trigrams. Calibrated against the
 * cases in the tests: a light rewording of a previous script scores above 0.9,
 * a genuinely new take on a topic the creator has covered before lands around
 * 0.2–0.35. 0.55 sits in the empty space between them, which is where a
 * threshold should sit rather than at a round number that feels decisive.
 */
const DUPLICATE_THRESHOLD = 0.55

/** Below this, the match is not close enough to be worth naming to the creator. */
const MENTION_THRESHOLD = 0.25

/**
 * A sentence or two. Short enough not to be busywork, long enough that it
 * cannot be satisfied by typing "yes" — which is the failure mode that would
 * turn the requirement into theatre.
 */
const MIN_COMMENTARY_WORDS = 20

/** FR-9.4 cadence warnings. Not blocking: fast publishing is legitimate, it is only a risk signal. */
const MAX_PER_DAY = 3
const MAX_PER_WEEK = 14

export interface GuardResult {
  verdict: GuardVerdict
  score: number
  similarity: number
  duplicateOf: string | null
  /**
   * Which rule blocked, so a client can route the creator to the fix without
   * re-deriving these thresholds on its side. A duplicated threshold across the
   * process boundary silently misroutes the moment this service is retuned —
   * and DUPLICATE_THRESHOLD is explicitly a calibrated value, so it will be.
   */
  blockedOn: GuardBlockReason | null
  hookEdited: boolean
  hasCommentary: boolean
  humanInputMs: number
  requiresDisclosure: boolean
  warnings: string[]
  reason: string | null
}

/** FR-9.4 — publishing faster than this is a pattern associated with strikes. */
async function cadenceWarnings(channelId: string | null): Promise<string[]> {
  if (!channelId) return []

  const now = Date.now()
  const [day, week] = await Promise.all([
    prisma.publication.count({
      where: { project: { channelId }, publishedAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
    }),
    prisma.publication.count({
      where: { project: { channelId }, publishedAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ])

  const warnings: string[] = []
  if (day >= MAX_PER_DAY) {
    warnings.push(
      `${day} videos published to this channel in the last 24 hours. Publishing this fast is a pattern YouTube associates with mass-produced content.`,
    )
  }
  if (week >= MAX_PER_WEEK) {
    warnings.push(
      `${week} videos published to this channel in the last 7 days. Consider spacing uploads out.`,
    )
  }
  return warnings
}

/**
 * FR-9.1 — runs the guard and records the result.
 *
 * Deliberately re-runnable: the creator fixes what was flagged and asks again.
 * The check is stored per project, so the latest verdict replaces the previous
 * one rather than accumulating.
 */
export async function runOriginalityCheck(projectId: string): Promise<GuardResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { script: true },
  })
  if (!project) throw notFound('No such project.')
  if (!project.script) {
    throw badRequest('This project has no script yet, so there is nothing to check.')
  }

  const script = project.script

  // Compare the generated material only. Commentary is the creator's own work
  // by definition, so including it would dilute the similarity score with text
  // that cannot be duplicated from the back catalogue.
  const beats = Array.isArray(script.beats) ? (script.beats as unknown[]) : []
  const candidate = [script.hook ?? '', ...beats.map((b) => (typeof b === 'string' ? b : JSON.stringify(b)))]
    .join(' ')
    .trim()

  const catalogue = project.channelId
    ? await prisma.channelVideo.findMany({
        where: { channelId: project.channelId },
        select: { youtubeVideoId: true, title: true, description: true },
      })
    : []

  const hit = candidate
    ? closestMatch(
        candidate,
        catalogue.map((v) => ({
          reference: v.youtubeVideoId,
          text: `${v.title} ${v.description ?? ''}`,
        })),
      )
    : null

  const similarity = hit?.score ?? 0
  const duplicateOf = hit && hit.score >= MENTION_THRESHOLD ? hit.reference : null

  // FR-9.3 / FR-9.6 — evidence a human was actually involved.
  const commentaryWords = script.commentary ? tokenise(script.commentary, false).length : 0
  const hasCommentary = commentaryWords >= MIN_COMMENTARY_WORDS
  const hookEdited = script.hookEditedAt !== null
  const humanInputMs = script.humanInputMs

  const warnings = await cadenceWarnings(project.channelId)

  // Blocking reasons, in the order most useful to act on.
  let verdict: GuardVerdict = GuardVerdict.PASS
  let reason: string | null = null
  let blockedOn: GuardBlockReason | null = null

  if (similarity >= DUPLICATE_THRESHOLD) {
    verdict = GuardVerdict.BLOCKED
    blockedOn = GuardBlockReason.SIMILARITY
    reason = duplicateOf
      ? `This script closely resembles a video already on the channel (${duplicateOf}). Rewrite it around a different angle, or add material that is genuinely new.`
      : 'This script closely resembles a video already on the channel. Rewrite it around a different angle.'
  } else if (!hasCommentary) {
    verdict = GuardVerdict.BLOCKED
    blockedOn = GuardBlockReason.COMMENTARY
    reason =
      commentaryWords === 0
        ? 'Add your own commentary before publishing. A video with no original insight is what YouTube demonetises as inauthentic.'
        : `Your commentary is ${commentaryWords} words. Write at least ${MIN_COMMENTARY_WORDS} so the video carries a genuine point of view.`
  } else if (!hookEdited) {
    verdict = GuardVerdict.BLOCKED
    blockedOn = GuardBlockReason.HOOK
    reason = 'Review and edit the opening hook before publishing. Publishing a generated hook unchanged is the pattern that gets channels flagged.'
  }

  // Originality score, reported whatever the verdict, so the creator can see
  // improvement rather than only pass or fail.
  const score = Math.max(
    0,
    Math.min(
      1,
      1 - similarity * 0.7 - (hasCommentary ? 0 : 0.2) - (hookEdited ? 0 : 0.1),
    ),
  )

  const result: GuardResult = {
    verdict,
    score: Number(score.toFixed(3)),
    similarity: Number(similarity.toFixed(3)),
    duplicateOf,
    blockedOn,
    hookEdited,
    hasCommentary,
    humanInputMs,
    // FR-9.5 — every video here uses a synthetic voice and generated visuals, so
    // YouTube's altered-content disclosure always applies. Left as a field rather
    // than a constant because real footage becomes possible in a later phase.
    requiresDisclosure: true,
    warnings,
    reason,
  }

  await prisma.originalityCheck.upsert({
    where: { projectId },
    create: { projectId, ...result },
    update: { ...result, checkedAt: new Date() },
  })

  logger.info({ projectId, verdict, similarity: result.similarity }, 'originality check completed')
  return result
}

export async function getOriginalityCheck(projectId: string) {
  return prisma.originalityCheck.findUnique({ where: { projectId } })
}

/**
 * FR-9.1 — the gate itself. Publishing (FR-10) calls this and must not proceed
 * without it.
 *
 * A missing check is treated as a block, not as permission. Failing open here
 * would make the whole guard bypassable by simply never running it.
 */
export async function assertPublishable(projectId: string): Promise<void> {
  const check = await prisma.originalityCheck.findUnique({ where: { projectId } })

  if (!check) {
    throw forbidden('This video has not been checked for originality yet. Run the check before publishing.')
  }
  if (check.verdict === GuardVerdict.BLOCKED) {
    throw forbidden(check.reason ?? 'This video did not pass the originality check.')
  }
}

export const THRESHOLDS = {
  DUPLICATE_THRESHOLD,
  MENTION_THRESHOLD,
  MIN_COMMENTARY_WORDS,
  MAX_PER_DAY,
  MAX_PER_WEEK,
} as const
