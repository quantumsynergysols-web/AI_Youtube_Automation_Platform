import Redis from 'ioredis'
import { env } from '../config/env'
import { logger } from './logger'

const globalForRedis = globalThis as unknown as { redis?: Redis }

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    // Tests import the app without a live Redis; connect on first use there.
    lazyConnect: env.NODE_ENV === 'test',
  })

redis.on('error', (err) => logger.error({ err }, 'redis error'))

if (env.NODE_ENV !== 'production') globalForRedis.redis = redis
