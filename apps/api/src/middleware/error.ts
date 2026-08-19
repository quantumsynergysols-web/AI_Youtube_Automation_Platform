import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'
import { isProd } from '../config/env'

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_failed',
        message: 'Check the highlighted fields and try again.',
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    })
    return
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    })
    return
  }

  logger.error({ err }, 'unhandled error')
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on our side. The team has been notified.',
      ...(isProd ? {} : { detail: String(err) }),
    },
  })
}

/** Wraps an async handler so a rejected promise reaches the error middleware. */
export function asyncRoute<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
