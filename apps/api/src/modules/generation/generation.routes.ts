import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../../lib/errors'
import { assertOwnsProject } from '../../lib/ownership'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import { llmProvider } from './providers/anthropic'
import { LlmRefusalError, LlmShapeError } from './providers/llm'
import { applyHumanEdits, generateScript, getScript } from './script.service'

const router = Router()

/**
 * Returns the configured provider or refuses the request.
 *
 * 501 rather than 500: nothing has gone wrong, the deployment simply has no
 * scriptwriting provider configured, and that is an operator problem the
 * message should say out loud.
 */
function requireProvider() {
  const provider = llmProvider()
  if (!provider) {
    throw new AppError(
      501,
      'provider_not_configured',
      'Scriptwriting is not configured on this server. Set ANTHROPIC_API_KEY and restart.',
    )
  }
  return provider
}

/**
 * FR-4 — write the script.
 *
 * Synchronous. A generation runs tens of seconds, which fits inside the
 * 120s proxy_read_timeout the deployment runbook sets, and keeping it in the
 * request avoids standing up job polling for a single call. If real timings
 * come in near that ceiling this becomes a 202 with a RenderJob, which is why
 * the response already carries everything a job result would.
 *
 * Re-runnable, and does not consume video allowance: allowance is charged when
 * a video is rendered, so a creator can reject a draft and ask again without
 * paying for the rejection.
 */
router.post(
  '/:id/script',
  requireAuth,
  asyncRoute(async (req, res) => {
    await assertOwnsProject(req.user!.sub, req.params.id!)
    const provider = requireProvider()

    try {
      res.json(await generateScript(req.params.id!, provider))
    } catch (err) {
      // A refusal and a malformed reply are both the model's doing, not the
      // creator's, so neither should surface as an opaque 500.
      if (err instanceof LlmRefusalError) {
        throw new AppError(422, 'provider_refused', err.message, { category: err.category })
      }
      if (err instanceof LlmShapeError) {
        throw new AppError(502, 'provider_bad_output', `${err.message} Try generating again.`)
      }
      throw err
    }
  }),
)

router.get(
  '/:id/script',
  requireAuth,
  asyncRoute(async (req, res) => {
    await assertOwnsProject(req.user!.sub, req.params.id!)
    const script = await getScript(req.params.id!)
    if (!script) {
      // Not an error: the creator has simply not generated one yet, and the UI
      // needs to say that rather than render a failure.
      res.json({ generated: false })
      return
    }
    res.json({ generated: true, ...script })
  }),
)

const editsBody = z
  .object({
    hook: z.string().max(500).optional(),
    commentary: z.string().max(5_000).optional(),
    // Rewrites to individual scenes. Without this a similarity block has no
    // remedy but regeneration, because the guard scores scene narration and
    // nothing else here could change it.
    scenes: z
      .array(z.object({ ordinal: z.number().int().min(0), narration: z.string().max(5_000) }))
      .max(100)
      .optional(),
    // How long the creator spent in the editor, measured by the client. Only
    // ever added to, and only ever corroborating evidence — the guard's real
    // test is whether the text actually changed.
    humanInputMs: z.number().int().min(0).max(6 * 60 * 60 * 1000).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update.' })

/** FR-4.5 — the human checkpoint the Originality Guard checks for. */
router.patch(
  '/:id/script',
  requireAuth,
  asyncRoute(async (req, res) => {
    await assertOwnsProject(req.user!.sub, req.params.id!)
    await applyHumanEdits(req.params.id!, editsBody.parse(req.body ?? {}))
    res.json(await getScript(req.params.id!))
  }),
)

export default router
