import { createApp } from './app'
import { env } from './config/env'
import { logger } from './lib/logger'
import { prisma } from './lib/prisma'
import { redis } from './lib/redis'

const app = createApp()
const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'api listening')
})

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  server.close()
  await Promise.allSettled([prisma.$disconnect(), redis.quit()])
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
