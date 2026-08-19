import rateLimit from 'express-rate-limit'
import { isTest } from '../config/env'

// Credential endpoints are the ones worth protecting in Phase 0.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 10_000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many attempts. Try again in 15 minutes.' } },
})

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: isTest ? 10_000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})
