import { Plan, SubscriptionStatus } from '@prisma/client'
import type Stripe from 'stripe'
import { env } from '../../config/env'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { badRequest, notFound, paymentRequired } from '../../lib/errors'
import { OVERAGE_PER_VIDEO_USD, planDefinition, planForPriceId, priceIdForPlan } from '../../config/plans'
import { stripe } from './stripe'

export async function subscriptionFor(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub) throw notFound('No subscription for this account.')
  return sub
}

export interface AllowanceView {
  plan: Plan
  status: SubscriptionStatus
  videosIncluded: number
  videosUsed: number
  videosRemaining: number
  overagePerVideoUsd: number
  periodEnd: Date
}

export async function allowance(userId: string): Promise<AllowanceView> {
  const sub = await subscriptionFor(userId)
  const def = planDefinition(sub.plan)
  return {
    plan: sub.plan,
    status: sub.status,
    videosIncluded: def.videosPerMonth,
    videosUsed: sub.videosUsed,
    videosRemaining: Math.max(0, def.videosPerMonth - sub.videosUsed),
    overagePerVideoUsd: OVERAGE_PER_VIDEO_USD,
    periodEnd: sub.periodEnd,
  }
}

/**
 * FR-12.2. Consumes one unit of allowance atomically.
 *
 * The conditional updateMany is the important part: two concurrent requests
 * cannot both read "1 remaining" and both succeed, because the second update
 * matches zero rows once videosUsed has moved.
 */
export async function consumeAllowance(userId: string, allowOverage = false): Promise<void> {
  const sub = await subscriptionFor(userId)
  const def = planDefinition(sub.plan)

  if (sub.status !== SubscriptionStatus.ACTIVE) {
    throw paymentRequired('Your subscription is not active. Update your billing details to continue.')
  }

  if (sub.videosUsed >= def.videosPerMonth && !allowOverage) {
    throw paymentRequired(
      `You have used all ${def.videosPerMonth} videos on the ${def.name} plan this period.`,
      { plan: sub.plan, videosIncluded: def.videosPerMonth, periodEnd: sub.periodEnd },
    )
  }

  const updated = await prisma.subscription.updateMany({
    where: allowOverage
      ? { userId, status: SubscriptionStatus.ACTIVE }
      : { userId, status: SubscriptionStatus.ACTIVE, videosUsed: { lt: def.videosPerMonth } },
    data: { videosUsed: { increment: 1 } },
  })

  if (updated.count === 0) {
    throw paymentRequired('You have used all the videos included in your plan this period.')
  }

  const isOverage = sub.videosUsed >= def.videosPerMonth
  await prisma.usageRecord.create({
    data: {
      userId,
      kind: isOverage ? 'video.overage' : 'video.included',
      units: 1,
      costUsd: isOverage ? OVERAGE_PER_VIDEO_USD : 0,
    },
  })
}

export async function createCheckoutSession(userId: string, email: string, plan: Plan) {
  const priceId = priceIdForPlan(plan)
  if (!priceId) throw badRequest(`No Stripe price is configured for the ${plan} plan.`)

  const sub = await subscriptionFor(userId)
  let customerId = sub.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } })
    customerId = customer.id
    await prisma.subscription.update({ where: { userId }, data: { stripeCustomerId: customerId } })
  }

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.WEB_PUBLIC_URL}/billing?checkout=success`,
    cancel_url: `${env.WEB_PUBLIC_URL}/billing?checkout=cancelled`,
    // Echoed back on the webhook so the event can be tied to the account.
    metadata: { userId, plan },
    subscription_data: { metadata: { userId, plan } },
  })
}

export async function createPortalSession(userId: string) {
  const sub = await subscriptionFor(userId)
  if (!sub.stripeCustomerId) throw badRequest('No billing account yet. Subscribe to a plan first.')
  return stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${env.WEB_PUBLIC_URL}/billing`,
  })
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return SubscriptionStatus.ACTIVE
    case 'past_due':
    case 'unpaid':
      return SubscriptionStatus.PAST_DUE
    case 'canceled':
      return SubscriptionStatus.CANCELED
    default:
      return SubscriptionStatus.INCOMPLETE
  }
}

/**
 * Stripe guarantees at-least-once delivery, so the event id is recorded first.
 * A redelivery finds the row and returns without re-applying the change.
 */
export async function handleWebhook(event: Stripe.Event): Promise<{ handled: boolean }> {
  const already = await prisma.processedWebhook.findUnique({ where: { id: event.id } })
  if (already) {
    logger.info({ eventId: event.id }, 'stripe webhook already processed, ignoring')
    return { handled: false }
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (userId && session.subscription) {
        const full = await stripe.subscriptions.retrieve(String(session.subscription))
        await applySubscription(userId, full)
      }
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.userId ?? (await userIdForCustomer(String(sub.customer)))
      if (userId) await applySubscription(userId, sub)
      break
    }
    case 'invoice.paid': {
      // A new period started: the video allowance resets.
      const invoice = event.data.object as Stripe.Invoice
      const userId = await userIdForCustomer(String(invoice.customer))
      if (userId) {
        await prisma.subscription.update({
          where: { userId },
          data: { videosUsed: 0, periodStart: new Date(), status: SubscriptionStatus.ACTIVE },
        })
      }
      break
    }
    default:
      logger.debug({ type: event.type }, 'unhandled stripe event')
  }

  await prisma.processedWebhook.create({ data: { id: event.id, type: event.type } })
  return { handled: true }
}

async function userIdForCustomer(customerId: string): Promise<string | null> {
  const sub = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } })
  return sub?.userId ?? null
}

async function applySubscription(userId: string, stripeSub: Stripe.Subscription) {
  const priceId = stripeSub.items.data[0]?.price?.id
  const plan = (priceId && planForPriceId(priceId)) || Plan.FREE
  const status = mapStripeStatus(stripeSub.status)
  const isEnding = stripeSub.status === 'canceled'

  await prisma.subscription.update({
    where: { userId },
    data: {
      plan: isEnding ? Plan.FREE : plan,
      status,
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId: String(stripeSub.customer),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      periodEnd: new Date(stripeSub.current_period_end * 1000),
    },
  })

  logger.info({ userId, plan, status }, 'subscription updated from stripe')
}
