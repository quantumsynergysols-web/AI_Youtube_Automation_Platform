import { Router } from 'express'
import { z } from 'zod'
import { JobStage } from '@prisma/client'
import { asyncRoute } from '../../middleware/error'
import { requireAuth } from '../../middleware/auth'
import { requireAllowance } from '../../middleware/allowance'
import { notFound } from '../../lib/errors'
import { prisma } from '../../lib/prisma'
import { enqueue, queueDepth } from '../../queue/producer'

const router = Router()

const dummyBody = z.object({
  message: z.string().min(1).max(500).default('hello from phase 0'),
  delayMs: z.number().int().min(0).max(10_000).optional(),
})

/**
 * Gate G0 probe. Enqueues a job the Python worker picks up, proving the
 * API, Redis and worker are wired together.
 *
 * Pass ?consume=1 to also exercise the allowance path end to end.
 */
router.post(
  '/dummy',
  requireAuth,
  asyncRoute(async (req, res, next) => {
    if (req.query.consume === '1') return requireAllowance()(req, res, next)
    next()
  }),
  asyncRoute(async (req, res) => {
    const body = dummyBody.parse(req.body ?? {})
    const job = await enqueue({
      type: 'dummy.echo',
      stage: JobStage.DUMMY,
      userId: req.user!.sub,
      payload: body,
    })
    res.status(202).json({ jobId: job.id, status: 'queued' })
  }),
)

router.get(
  '/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const job = await prisma.renderJob.findUnique({ where: { id: req.params.id! } })
    if (!job || job.userId !== req.user!.sub) throw notFound('No such job.')
    res.json({
      id: job.id,
      stage: job.stage,
      status: job.status,
      attempts: job.attempts,
      result: job.result,
      error: job.error,
      enqueuedAt: job.enqueuedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    })
  }),
)

router.get(
  '/',
  requireAuth,
  asyncRoute(async (req, res) => {
    const jobs = await prisma.renderJob.findMany({
      where: { userId: req.user!.sub },
      orderBy: { enqueuedAt: 'desc' },
      take: 20,
    })
    res.json({ jobs, queue: await queueDepth() })
  }),
)

export default router
