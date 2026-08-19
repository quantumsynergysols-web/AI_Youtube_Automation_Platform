import { describe, expect, it } from 'vitest'
import { Plan } from '@prisma/client'
import {
  ALL_PLANS,
  OVERAGE_PER_VIDEO_USD,
  planDefinition,
  planForPriceId,
  priceIdForPlan,
} from '../src/config/plans'

describe('plan catalogue', () => {
  it('matches the pricing committed in the SRS business model', () => {
    expect(planDefinition(Plan.FREE).videosPerMonth).toBe(3)
    expect(planDefinition(Plan.STARTER)).toMatchObject({ priceUsd: 29, videosPerMonth: 10 })
    expect(planDefinition(Plan.CREATOR)).toMatchObject({ priceUsd: 79, videosPerMonth: 30 })
    expect(planDefinition(Plan.PRO)).toMatchObject({ priceUsd: 199, videosPerMonth: 90 })
    expect(planDefinition(Plan.STUDIO)).toMatchObject({ priceUsd: 399, videosPerMonth: 200 })
    expect(OVERAGE_PER_VIDEO_USD).toBe(0.6)
  })

  it('keeps revenue per video above the $0.96 unit cost on every paid plan', () => {
    for (const plan of ALL_PLANS.filter((p) => p.priceUsd > 0)) {
      const revenuePerVideo = plan.priceUsd / plan.videosPerMonth
      expect(revenuePerVideo).toBeGreaterThan(0.96)
    }
  })

  it('only the free plan is barred from publishing', () => {
    expect(planDefinition(Plan.FREE).canPublish).toBe(false)
    expect(planDefinition(Plan.STARTER).canPublish).toBe(true)
  })

  it('round-trips a configured price id back to its plan', () => {
    const priceId = priceIdForPlan(Plan.CREATOR)
    expect(priceId).toBe('price_creator_test')
    expect(planForPriceId(priceId!)).toBe(Plan.CREATOR)
  })

  it('returns null for an unrecognised price id rather than guessing a plan', () => {
    expect(planForPriceId('price_not_ours')).toBeNull()
  })
})
