import { Router } from 'express'
import { asyncRoute } from '../../middleware/error'
import { prisma } from '../../lib/prisma'
import { redis } from '../../lib/redis'
import { queueDepth } from '../../queue/producer'

const router = Router()

router.get('/live', (_req, res) => res.json({ status: 'ok' }))

router.get(
  '/ready',
  asyncRoute(async (_req, res) => {
    const checks: Record<string, string> = {}
    let healthy = true

    try {
      await prisma.$queryRaw`SELECT 1`
      checks.database = 'ok'
    } catch {
      checks.database = 'unreachable'
      healthy = false
    }

    try {
      await redis.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'unreachable'
      healthy = false
    }

    const body: Record<string, unknown> = { status: healthy ? 'ok' : 'degraded', checks }
    if (healthy) body.queue = await queueDepth()

    res.status(healthy ? 200 : 503).json(body)
  }),
)

export default router
