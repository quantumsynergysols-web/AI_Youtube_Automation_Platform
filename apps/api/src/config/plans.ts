import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { Plan } from '@prisma/client'
import { env } from './env'

export interface PlanDefinition {
  id: string
  name: string
  priceUsd: number
  videosPerMonth: number
  channels: number
  maxDurationSec: number
  watermark: boolean
  canPublish: boolean
}

interface PlansFile {
  currency: string
  overagePerVideoUsd: number
  plans: PlanDefinition[]
}

// contracts/ is shared with the Python worker. It sits at the repo root in dev
// and is copied to /contracts in the images.
function locateContracts(): string {
  const candidates = [
    path.resolve(__dirname, '../../../../contracts/plans.json'),
    path.resolve(process.cwd(), '../../contracts/plans.json'),
    '/contracts/plans.json',
  ]
  const found = candidates.find((c) => existsSync(c))
  if (!found) throw new Error(`contracts/plans.json not found. Looked in:\n${candidates.join('\n')}`)
  return found
}

const file: PlansFile = JSON.parse(readFileSync(locateContracts(), 'utf8'))

export const OVERAGE_PER_VIDEO_USD = file.overagePerVideoUsd

const byId = new Map(file.plans.map((p) => [p.id, p]))

export function planDefinition(plan: Plan): PlanDefinition {
  const def = byId.get(plan.toLowerCase())
  if (!def) throw new Error(`No plan definition for ${plan}`)
  return def
}

export const ALL_PLANS: PlanDefinition[] = file.plans

/** Maps a Stripe price id back to the plan it grants. */
export function planForPriceId(priceId: string): Plan | null {
  const map: Record<string, Plan> = {}
  if (env.STRIPE_PRICE_STARTER) map[env.STRIPE_PRICE_STARTER] = Plan.STARTER
  if (env.STRIPE_PRICE_CREATOR) map[env.STRIPE_PRICE_CREATOR] = Plan.CREATOR
  if (env.STRIPE_PRICE_PRO) map[env.STRIPE_PRICE_PRO] = Plan.PRO
  if (env.STRIPE_PRICE_STUDIO) map[env.STRIPE_PRICE_STUDIO] = Plan.STUDIO
  return map[priceId] ?? null
}

export function priceIdForPlan(plan: Plan): string | null {
  switch (plan) {
    case Plan.STARTER: return env.STRIPE_PRICE_STARTER ?? null
    case Plan.CREATOR: return env.STRIPE_PRICE_CREATOR ?? null
    case Plan.PRO: return env.STRIPE_PRICE_PRO ?? null
    case Plan.STUDIO: return env.STRIPE_PRICE_STUDIO ?? null
    default: return null
  }
}
