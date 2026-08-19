import { Router } from 'express'
import { z } from 'zod'
import { env } from '../../config/env'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import { logger } from '../../lib/logger'
import * as service from './channels.service'

const router = Router()

router.get(
  '/',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json({ channels: await service.listChannels(req.user!.sub) })
  }),
)

/** Returns the Google consent URL. The browser navigates to it; we do not redirect
 *  from here, so the SPA can show its own explanation of the permissions first. */
router.post(
  '/connect',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await service.startConnect(req.user!.sub))
  }),
)

/**
 * Google redirects the browser here after consent. This is the one route that is
 * not authenticated by our own token — the user arrives from Google, not from the
 * SPA — so the `state` value is what ties the callback back to an account.
 */
router.get(
  '/callback',
  asyncRoute(async (req, res) => {
    const query = z
      .object({
        code: z.string().optional(),
        state: z.string().optional(),
        error: z.string().optional(),
      })
      .parse(req.query)

    const back = (params: Record<string, string>) =>
      res.redirect(`${env.WEB_PUBLIC_URL}/channels?${new URLSearchParams(params)}`)

    // The creator pressed Cancel on Google's screen. Not an error worth a stack trace.
    if (query.error) return back({ connected: 'cancelled' })
    if (!query.code || !query.state) return back({ connected: 'error', reason: 'missing_code' })

    try {
      const channel = await service.completeConnect(query.code, query.state)
      return back({ connected: 'success', channel: channel.title })
    } catch (err) {
      // Redirect with a readable reason rather than rendering JSON at the user:
      // they are in a browser tab they expect to land back in the app.
      const message = err instanceof Error ? err.message : 'Could not connect that channel.'
      logger.warn({ err }, 'channel connect callback failed')
      return back({ connected: 'error', reason: message })
    }
  }),
)

router.delete(
  '/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    await service.disconnect(req.user!.sub, req.params.id!)
    res.status(204).end()
  }),
)

export default router
