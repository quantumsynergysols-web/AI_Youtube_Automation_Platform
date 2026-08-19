import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import pinoHttp from 'pino-http'
import { env } from './config/env'
import { logger } from './lib/logger'
import { errorHandler, notFoundHandler } from './middleware/error'
import { generalLimiter } from './middleware/rateLimit'
import authRoutes from './modules/auth/auth.routes'
import billingRoutes, { webhookRouter } from './modules/billing/billing.routes'
import channelRoutes from './modules/channels/channels.routes'
import jobRoutes from './modules/jobs/jobs.routes'
import generationRoutes from './modules/generation/generation.routes'
import originalityRoutes from './modules/originality/originality.routes'
import healthRoutes from './modules/health/health.routes'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: env.WEB_PUBLIC_URL, credentials: true }))
  app.use(pinoHttp({ logger }))

  // Must precede express.json(): Stripe signs the raw bytes.
  app.use('/api/billing', webhookRouter)

  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(generalLimiter)

  app.use('/health', healthRoutes)
  app.use('/api/auth', authRoutes)
  app.use('/api/billing', billingRoutes)
  app.use('/api/channels', channelRoutes)
  app.use('/api/jobs', jobRoutes)
  app.use('/api/projects', generationRoutes)
  app.use('/api/projects', originalityRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
