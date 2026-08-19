import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { Plan, TokenPurpose, UserStatus } from '@prisma/client'

const mailMessages = vi.hoisted(() => [] as Array<{ to: string; subject: string; text: string }>)

vi.mock('../../src/lib/mailer', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/lib/mailer')>()
  return {
    ...original,
    sendMail: vi.fn(async (to: string, subject: string, text: string) => {
      mailMessages.push({ to, subject, text })
    }),
  }
})

import { createApp } from '../../src/app'
import { prisma } from '../../src/lib/prisma'
import { redis } from '../../src/lib/redis'
import { hashToken } from '../../src/lib/tokens'
import { consumeAllowance } from '../../src/modules/billing/billing.service'
import { stripe } from '../../src/modules/billing/stripe'

const app = createApp()
const password = 'Correct horse battery staple 123!'

function uniqueEmail(label: string): string {
  return `${label}.${randomUUID()}@example.test`
}

function tokenFromLatestMail(email: string, path: 'verify-email' | 'reset-password'): string {
  const mail = [...mailMessages].reverse().find((message) => message.to === email)
  if (!mail) throw new Error(`No email captured for ${email}`)
  const match = mail.text.match(new RegExp(`/${path}\\?token=([^\\s]+)`))
  if (!match?.[1]) throw new Error(`No ${path} token found in email for ${email}`)
  return decodeURIComponent(match[1])
}

async function register(email = uniqueEmail('user')) {
  const response = await request(app).post('/api/auth/register').send({ email, password })
  expect(response.status).toBe(201)
  return { email, userId: response.body.user.id as string, verificationToken: tokenFromLatestMail(email, 'verify-email') }
}

async function registerAndVerify(email = uniqueEmail('active')) {
  const account = await register(email)
  const response = await request(app).post('/api/auth/verify-email').send({ token: account.verificationToken })
  expect(response.status).toBe(200)
  return account
}

async function login(email: string, candidate = password) {
  return request(app).post('/api/auth/login').send({ email, password: candidate })
}

async function truncateDatabase() {
  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE table_name text;
    BEGIN
      FOR table_name IN SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', table_name);
      END LOOP;
    END $$;
  `)
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`
  if (redis.status === 'wait') await redis.connect()
  expect(await redis.ping()).toBe('PONG')
})

beforeEach(async () => {
  mailMessages.length = 0
  await truncateDatabase()
  await redis.flushdb()
})

afterAll(async () => {
  await prisma.$disconnect()
  if (redis.status !== 'end') await redis.quit()
})

describe('DB-backed auth, billing, and allowance flows', () => {
  it('registers a pending user with an active FREE subscription', async () => {
    const account = await register()
    const user = await prisma.user.findUnique({ where: { id: account.userId }, include: { subscription: true } })
    expect(user).toMatchObject({ email: account.email, status: UserStatus.PENDING_VERIFICATION })
    expect(user?.subscription).toMatchObject({ plan: Plan.FREE, status: 'ACTIVE', videosUsed: 0 })
  })

  it('refuses an authenticated but unverified user on a protected route', async () => {
    const account = await register()
    const session = await login(account.email)
    expect(session.status).toBe(200)
    const response = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('forbidden')
  })

  it('verifies email once, rejects expiry, and stores only the SHA-256 token hash', async () => {
    const account = await register()
    const record = await prisma.authToken.findFirstOrThrow({
      where: { userId: account.userId, purpose: TokenPurpose.EMAIL_VERIFICATION },
    })
    expect(record.tokenHash).toBe(hashToken(account.verificationToken))
    expect(record.tokenHash).not.toBe(account.verificationToken)
    expect(record.tokenHash).toMatch(/^[a-f0-9]{64}$/)
    expect((await request(app).post('/api/auth/verify-email').send({ token: account.verificationToken })).status).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: account.userId } })).status).toBe(UserStatus.ACTIVE)
    expect((await request(app).post('/api/auth/verify-email').send({ token: account.verificationToken })).status).toBe(400)

    const expiredRaw = 'expired-verification-token'
    await prisma.authToken.create({ data: {
      userId: account.userId, purpose: TokenPurpose.EMAIL_VERIFICATION,
      tokenHash: hashToken(expiredRaw), expiresAt: new Date(Date.now() - 1_000),
    } })
    expect((await request(app).post('/api/auth/verify-email').send({ token: expiredRaw })).status).toBe(400)
  })

  it('logs in after verification and rejects a wrong password', async () => {
    const account = await registerAndVerify()
    const success = await login(account.email)
    expect(success.status).toBe(200)
    expect(success.body).toMatchObject({ user: { id: account.userId, status: UserStatus.ACTIVE } })
    expect(success.body.accessToken).toEqual(expect.any(String))
    expect(success.body.refreshToken).toEqual(expect.any(String))
    const failure = await login(account.email, 'definitely-the-wrong-password')
    expect(failure.status).toBe(401)
    expect(failure.body.error.code).toBe('unauthorized')
  })

  it('rotates refresh tokens and rejects replay of the presented token', async () => {
    const account = await registerAndVerify()
    const initial = await login(account.email)
    const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: initial.body.refreshToken })
    expect(rotated.status).toBe(200)
    expect(rotated.body.refreshToken).not.toBe(initial.body.refreshToken)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken })).status).toBe(200)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: initial.body.refreshToken })).status).toBe(401)
  })

  it('uses a password reset token once and revokes every refresh session', async () => {
    const account = await registerAndVerify()
    const first = await login(account.email)
    const second = await login(account.email)
    expect((await request(app).post('/api/auth/forgot-password').send({ email: account.email })).status).toBe(200)
    const resetToken = tokenFromLatestMail(account.email, 'reset-password')
    const newPassword = 'A brand new secure password 456!'
    expect((await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: newPassword })).status).toBe(200)
    for (const refreshToken of [first.body.refreshToken, second.body.refreshToken]) {
      expect((await request(app).post('/api/auth/refresh').send({ refreshToken })).status).toBe(401)
    }
    expect((await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: newPassword })).status).toBe(400)
    expect((await login(account.email, password)).status).toBe(401)
    expect((await login(account.email, newPassword)).status).toBe(200)
  })

  it('decrements FREE allowance, records usage, and returns allowance_exhausted after three videos', async () => {
    const account = await registerAndVerify()
    const session = await login(account.email)
    for (let count = 1; count <= 3; count += 1) {
      const consumed = await request(app).post('/api/jobs/dummy?consume=1')
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .send({ message: `allowance integration ${count}` })
      expect(consumed.status).toBe(202)
      expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: account.userId } })).videosUsed).toBe(count)
    }
    expect(await prisma.usageRecord.count({ where: { userId: account.userId } })).toBe(3)
    const exhausted = await request(app).post('/api/jobs/dummy?consume=1')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .send({ message: 'one too many' })
    expect(exhausted.status).toBe(402)
    expect(exhausted.body.error.code).toBe('allowance_exhausted')
  })

  it('allows exactly one concurrent consumption when one video remains', async () => {
    const account = await registerAndVerify()
    await prisma.subscription.update({ where: { userId: account.userId }, data: { videosUsed: 2 } })
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => consumeAllowance(account.userId)))
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(11)
    for (const result of rejected) {
      if (result.status === 'rejected') expect(result.reason).toMatchObject({ status: 402, code: 'allowance_exhausted' })
    }
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: account.userId } })).videosUsed).toBe(3)
    expect(await prisma.usageRecord.count({ where: { userId: account.userId } })).toBe(1)
  })

  it('applies a correctly signed Stripe webhook once and rejects invalid signatures', async () => {
    const account = await registerAndVerify()
    const event = {
      id: `evt_${randomUUID()}`, object: 'event', api_version: '2025-02-24.acacia',
      created: Math.floor(Date.now() / 1000), livemode: false, pending_webhooks: 1,
      request: null, type: 'customer.subscription.updated',
      data: { object: {
        id: `sub_${randomUUID()}`, object: 'subscription', customer: `cus_${randomUUID()}`,
        status: 'active', metadata: { userId: account.userId }, cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 2_592_000,
        items: { data: [{ price: { id: process.env.STRIPE_PRICE_CREATOR } }] },
      } },
    }
    const payload = JSON.stringify(event)
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! })
    const deliver = () => request(app).post('/api/billing/webhook').set('Content-Type', 'application/json')
      .set('stripe-signature', signature).send(payload)
    const first = await deliver()
    const duplicate = await deliver()
    expect(first.status).toBe(200)
    expect(first.body.handled).toBe(true)
    expect(duplicate.status).toBe(200)
    expect(duplicate.body.handled).toBe(false)
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: account.userId } })).plan).toBe(Plan.CREATOR)
    expect(await prisma.processedWebhook.count({ where: { id: event.id } })).toBe(1)
    expect((await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json').send(payload)).status).toBe(400)
    const wrong = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_wrong_secret' })
    expect((await request(app).post('/api/billing/webhook').set('Content-Type', 'application/json')
      .set('stripe-signature', wrong).send(payload)).status).toBe(400)
  })

  it('soft-deletes an account, revokes sessions, and releases its email for registration', async () => {
    const account = await registerAndVerify()
    const session = await login(account.email)
    expect((await request(app).delete('/api/auth/me')
      .set('Authorization', `Bearer ${session.body.accessToken}`)).status).toBe(204)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: account.userId } })
    expect(user).toMatchObject({ status: UserStatus.DELETED, passwordHash: null })
    expect(user.deletedAt).toBeInstanceOf(Date)
    expect(user.email).not.toBe(account.email)
    expect((await prisma.refreshSession.findMany({ where: { userId: account.userId } })).every((item) => item.revokedAt)).toBe(true)
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: session.body.refreshToken })).status).toBe(401)
    const replacement = await request(app).post('/api/auth/register').send({ email: account.email, password })
    expect(replacement.status).toBe(201)
    expect(replacement.body.user.id).not.toBe(account.userId)
  })
})
