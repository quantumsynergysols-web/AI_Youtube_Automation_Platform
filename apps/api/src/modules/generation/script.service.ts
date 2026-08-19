import { ProjectState, SceneRole } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { badRequest, notFound } from '../../lib/errors'
import { LlmShapeError, type LlmProvider } from './providers/llm'
import { ScriptDraftSchema, type SceneDraft, type ScriptDraft } from './script.schema'
import { SCRIPT_SYSTEM_PROMPT, buildScriptPrompt } from './script.prompt'

/**
 * FR-4 — the scriptwriter.
 *
 * Runs in the API process rather than the Python worker. The split across the
 * two runtimes is by dependency, not by how long the work takes: the worker
 * owns media (voice, images, ffmpeg), the API owns text and data, because the
 * text stages need Prisma and provider credentials the worker has no reason to
 * hold. FR-2's history import already sits on the same side of that line for
 * the same reason.
 */

/** How many recent videos to show the model as covered ground. */
const CATALOGUE_CONTEXT_SIZE = 25

/** Order the video has to come out in, whatever order the model returned. */
const ROLE_ORDER: Record<SceneRole, number> = {
  [SceneRole.HOOK]: 0,
  [SceneRole.INTRODUCTION]: 1,
  [SceneRole.BODY]: 2,
  [SceneRole.CALL_TO_ACTION]: 3,
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Puts the scenes in broadcast order without discarding any.
 *
 * The prompt asks for hook-first and call-to-action-last, and the model
 * generally obliges. When it does not, reordering is a deterministic repair
 * that costs nothing, whereas rejecting the draft throws away a whole paid
 * generation over a fault that does not affect a single word of the content.
 * Relative order within a role is preserved, so the body keeps its argument.
 */
export function orderScenes(scenes: SceneDraft[]): SceneDraft[] {
  return scenes
    .map((scene, index) => ({ scene, index }))
    .sort((a, b) => {
      const byRole = ROLE_ORDER[a.scene.role] - ROLE_ORDER[b.scene.role]
      return byRole !== 0 ? byRole : a.index - b.index
    })
    .map((entry) => entry.scene)
}

/**
 * Checks the things the output schema cannot express.
 *
 * Structured outputs carry no length or cardinality constraints, so these are
 * enforced here — where a failure can name what went wrong — rather than by
 * zod, which would only report that the shape did not match.
 */
export function validateDraft(draft: ScriptDraft): void {
  const parsed = ScriptDraftSchema.safeParse(draft)
  if (!parsed.success) {
    throw new LlmShapeError('The script did not match the expected shape.', parsed.error)
  }

  if (draft.scenes.length < 2) {
    throw new LlmShapeError(
      `The script came back with ${draft.scenes.length} scene(s); a video needs at least 2.`,
    )
  }
  if (!draft.scenes.some((s) => s.role === SceneRole.HOOK)) {
    throw new LlmShapeError('The script came back without a hook.')
  }
  if (!draft.artDirection.trim()) {
    throw new LlmShapeError(
      'The script came back without art direction, so the visuals would drift between scenes.',
    )
  }

  const blank = draft.scenes.findIndex((s) => !s.narration.trim() || !s.visualPrompt.trim())
  if (blank !== -1) {
    throw new LlmShapeError(`Scene ${blank + 1} came back missing its narration or its image prompt.`)
  }
}

export interface TimedScene {
  ordinal: number
  role: SceneRole
  narration: string
  prompt: string
  startMs: number
  endMs: number
}

export interface GeneratedScript {
  scriptId: string
  title: string
  hook: string
  artDirection: string
  wordCount: number
  estimatedDurationSec: number
  scenes: TimedScene[]
}

export async function generateScript(
  projectId: string,
  provider: LlmProvider,
): Promise<GeneratedScript> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { channel: { select: { title: true } } },
  })
  if (!project) throw notFound('No such project.')

  await prisma.project.update({
    where: { id: projectId },
    data: { state: ProjectState.SCRIPTING },
  })

  try {
    // What the channel has already published, handed to the model as territory
    // to avoid. A script the Originality Guard then blocks is not a partially
    // useful result — it is one the creator cannot publish at all.
    const catalogue = project.channelId
      ? await prisma.channelVideo.findMany({
          where: { channelId: project.channelId },
          select: { title: true },
          orderBy: { publishedAt: 'desc' },
          take: CATALOGUE_CONTEXT_SIZE,
        })
      : []

    const generated = await provider.generate({
      system: SCRIPT_SYSTEM_PROMPT,
      prompt: buildScriptPrompt({
        topic: project.topic,
        targetDurationSec: project.targetDurationSec,
        language: project.language,
        style: project.style,
        channelTitle: project.channel?.title ?? null,
        recentVideoTitles: catalogue.map((v) => v.title),
      }),
      schema: ScriptDraftSchema,
      schemaName: 'script_draft',
      effort: 'high',
    })

    const draft = generated.data
    validateDraft(draft)
    const ordered = orderScenes(draft.scenes)

    // Lay the scenes on a timeline now so the voice and visual stages have
    // somewhere to render into. These are the model's estimates and get
    // rewritten with real durations once the audio exists.
    let cursorMs = 0
    const timed: TimedScene[] = ordered.map((scene, i) => {
      const startMs = cursorMs
      const endMs = startMs + Math.max(1, Math.round(scene.estimatedSeconds * 1000))
      cursorMs = endMs
      return {
        ordinal: i,
        role: scene.role,
        narration: scene.narration.trim(),
        prompt: scene.visualPrompt.trim(),
        startMs,
        endMs,
      }
    })

    const hookScene = timed.find((s) => s.role === SceneRole.HOOK)!
    const wordCount = timed.reduce((sum, s) => sum + countWords(s.narration), 0)
    const artDirection = draft.artDirection.trim()
    // Narration only, and without the hook — FR-9 concatenates hook and beats to
    // measure similarity, so image prompts or a repeated hook in here would
    // score the video against text nobody ever hears.
    const beats = timed.filter((s) => s.role !== SceneRole.HOOK).map((s) => s.narration)

    const script = await prisma.$transaction(async (tx) => {
      const saved = await tx.script.upsert({
        where: { projectId },
        create: {
          projectId,
          artDirection,
          hook: hookScene.narration,
          beats,
          wordCount,
        },
        update: {
          artDirection,
          hook: hookScene.narration,
          beats,
          wordCount,
          // Regenerating replaces the hook, so an earlier human review of the
          // previous hook no longer applies to this one. Leaving the timestamp
          // set would let a freshly generated hook satisfy FR-9's human-input
          // requirement without anyone having read it, which is the exact hole
          // the guard exists to close. Commentary is kept: it is the creator's
          // own writing, and discarding their work to regenerate ours is rude.
          hookEditedAt: null,
        },
      })

      // Scenes are positional, so a regeneration replaces them wholesale rather
      // than trying to match old ordinals onto new ones.
      await tx.scene.deleteMany({ where: { scriptId: saved.id } })
      await tx.scene.createMany({ data: timed.map((s) => ({ ...s, scriptId: saved.id })) })

      await tx.project.update({
        where: { id: projectId },
        data: { state: ProjectState.AWAITING_APPROVAL },
      })

      return saved
    })

    logger.info(
      {
        projectId,
        scriptId: script.id,
        model: generated.model,
        latencyMs: generated.latencyMs,
        scenes: timed.length,
        wordCount,
        ...generated.usage,
      },
      'script generated',
    )

    return {
      scriptId: script.id,
      title: draft.title.trim(),
      hook: hookScene.narration,
      artDirection,
      wordCount,
      estimatedDurationSec: Math.round(cursorMs / 1000),
      scenes: timed,
    }
  } catch (err) {
    // Back to DRAFT rather than FAILED: nothing is broken and the creator can
    // simply ask again. FAILED is for a project that needs intervention.
    await prisma.project
      .update({ where: { id: projectId }, data: { state: ProjectState.DRAFT } })
      .catch(() => undefined)
    throw err
  }
}

export interface HumanEdits {
  hook?: string
  commentary?: string
  humanInputMs?: number
}

/**
 * FR-4.5 / FR-9.3 — the human checkpoint.
 *
 * The timestamps written here are what the Originality Guard reads to decide a
 * person was actually involved, so they are derived from the edit itself and
 * are never accepted from the client.
 */
export async function applyHumanEdits(projectId: string, edits: HumanEdits): Promise<void> {
  const script = await prisma.script.findUnique({
    where: { projectId },
    select: { id: true, hook: true },
  })
  if (!script) throw notFound('This project has no script yet.')

  const data: Record<string, unknown> = {}
  const now = new Date()

  if (edits.hook !== undefined) {
    const hook = edits.hook.trim()
    if (!hook) throw badRequest('The hook cannot be empty.')
    data.hook = hook
    // Only counts as reviewed if they actually changed it. Opening the editor
    // and saving the generated line untouched is not human input, and treating
    // it as such would make the guard satisfiable with one click.
    if (hook !== script.hook) {
      data.hookEditedAt = now
      data.humanEditedAt = now
    }
  }

  if (edits.commentary !== undefined) {
    const commentary = edits.commentary.trim()
    data.commentary = commentary || null
    data.commentaryAddedAt = commentary ? now : null
    data.humanEditedAt = now
  }

  if (edits.humanInputMs !== undefined) {
    // Accumulates across sittings and never decreases — the field is evidence
    // for a strike appeal, so a later short edit must not erase a long one.
    data.humanInputMs = { increment: Math.max(0, Math.round(edits.humanInputMs)) }
  }

  if (Object.keys(data).length === 0) throw badRequest('Nothing to update.')

  await prisma.script.update({ where: { id: script.id }, data })
  logger.info({ projectId, fields: Object.keys(data) }, 'human edits applied to script')
}

export async function getScript(projectId: string) {
  return prisma.script.findUnique({
    where: { projectId },
    include: { scenes: { orderBy: { ordinal: 'asc' } } },
  })
}
