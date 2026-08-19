import { randomUUID } from 'node:crypto'
import { JobStage, JobStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'

// Protocol contracts/jobs.json "redis-list-v1". Deliberately not BullMQ:
// the generation workers are Python (SRS §5.1), so the queue has to be
// readable from both runtimes. LPUSH here, BRPOPLPUSH in the worker.
export const QUEUE = 'default'
export const pendingKey = (q = QUEUE) => `q:${q}`
export const processingKey = (q = QUEUE) => `q:${q}:processing`
export const deadKey = (q = QUEUE) => `q:${q}:dead`
export const recordKey = (id: string) => `job:${id}`

export interface JobMessage {
  id: string
  type: string
  stage: JobStage
  userId: string | null
  projectId: string | null
  payload: Record<string, unknown>
  attempts: number
  maxAttempts: number
  enqueuedAt: string
}

export interface EnqueueOptions {
  type: string
  stage: JobStage
  userId?: string | null
  projectId?: string | null
  payload?: Record<string, unknown>
  maxAttempts?: number
}

export async function enqueue(opts: EnqueueOptions): Promise<JobMessage> {
  const id = randomUUID()
  const message: JobMessage = {
    id,
    type: opts.type,
    stage: opts.stage,
    userId: opts.userId ?? null,
    projectId: opts.projectId ?? null,
    payload: opts.payload ?? {},
    attempts: 0,
    maxAttempts: opts.maxAttempts ?? 3,
    enqueuedAt: new Date().toISOString(),
  }

  // Persist before enqueueing. If the LPUSH fails the row is still visible to
  // an operator; the reverse would leave an untracked job running.
  await prisma.renderJob.create({
    data: {
      id,
      stage: opts.stage,
      status: JobStatus.QUEUED,
      userId: opts.userId ?? null,
      projectId: opts.projectId ?? null,
      payload: message.payload as object,
      maxAttempts: message.maxAttempts,
    },
  })

  const body = JSON.stringify(message)
  await redis
    .multi()
    .hset(recordKey(id), { status: 'queued', message: body })
    .expire(recordKey(id), 60 * 60 * 24 * 7)
    .lpush(pendingKey(), body)
    .exec()

  logger.info({ jobId: id, type: opts.type }, 'job enqueued')
  return message
}

export async function queueDepth(): Promise<{ pending: number; processing: number; dead: number }> {
  const [pending, processing, dead] = await Promise.all([
    redis.llen(pendingKey()),
    redis.llen(processingKey()),
    redis.llen(deadKey()),
  ])
  return { pending, processing, dead }
}
