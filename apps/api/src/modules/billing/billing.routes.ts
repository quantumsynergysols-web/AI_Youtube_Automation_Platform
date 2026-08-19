import { Router, raw } from 'express'
import { z } from 'zod'
import { Plan } from '@prisma/client'
import type Stripe from 'stripe'
import { env } from '../../config/env'
import { ALL_PLANS } from '../../config/plans'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import { badRequest } from '../../lib/errors'
import { logger } from '../../lib/logger'
import { stripe } from './stripe'
import * as service from './billing.service'

const router = Router()

router.get('/plans', (_req, res) => {
  res.json({ plans: ALL_PLANS })
})

router.get(
  '/allowance',
  requireAuth,
  asyncRoute(async (req, res) => {
    res.json(await service.allowance(req.user!.sub))
  }),
)

router.post(
  '/checkout',
  requireAuth,
  asyncRoute(async (req, res) => {
    const body = z.object({ plan: z.nativeEnum(Plan) }).parse(req.body)
    if (body.plan === Plan.FREE) throw badRequest('The Free plan does not need checkout.')
    const session = await service.createCheckoutSession(req.user!.sub, req.user!.email, body.plan)
    res.json({ url: session.url, sessionId: session.id })
  }),
)

router.post(
  '/portal',
  requireAuth,
  asyncRoute(async (req, res) => {
    const session = await service.createPortalSession(req.user!.sub)
    res.json({ url: session.url })
  }),
)

/**
 * Stripe signs the exact bytes it sent, so this route needs the raw body.
 * It is registered before the JSON parser in app.ts for that reason.
 */
export const webhookRouter = Router()

webhookRouter.post(
  '/webhook',
  raw({ type: 'application/json' }),
  asyncRoute(async (req, res) => {
    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string') throw badRequest('Missing stripe-signature header.')

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
      logger.warn({ err }, 'stripe webhook signature verification failed')
      throw badRequest('Signature verification failed.')
    }

    const result = await service.handleWebhook(event)
    res.json({ received: true, ...result })
  }),
)

export default router
