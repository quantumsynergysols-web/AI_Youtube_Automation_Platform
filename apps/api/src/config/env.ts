import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

// The .env lives at the repo root and is shared with the worker, so load it
// explicitly rather than relying on the process cwd.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })
dotenv.config()

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  API_PORT: z.coerce.number().int().positive().default(4300),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4300'),
  WEB_PUBLIC_URL: z.string().url().default('http://localhost:5273'),

  // 32 chars is the floor for HS256 to be worth anything.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_CREATOR: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_STUDIO: z.string().optional(),

  // Optional: without it the Google sign-in route reports 501 rather than
  // preventing the whole service from booting.
  GOOGLE_CLIENT_ID: z.string().optional(),
  // Channel connection (FR-2) additionally needs the secret and a redirect URI,
  // because it uses the authorization code flow rather than an ID token.
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // base64 of 32 random bytes: openssl rand -base64 32
  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('ViralPilot <no-reply@viralpilot.io>'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  // Fail at boot rather than at the first request that needs the value.
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'
export const isTest = env.NODE_ENV === 'test'
