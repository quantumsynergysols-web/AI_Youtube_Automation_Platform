import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { Plan, SubscriptionStatus, TokenPurpose, UserStatus } from '@prisma/client'
import { env } from '../../config/env'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { badRequest, conflict, unauthorized } from '../../lib/errors'
import { expiresIn, generateToken, hashToken } from '../../lib/tokens'
import { resetEmail, sendMail, verificationEmail } from '../../lib/mailer'
import { signAccessToken } from '../../middleware/auth'

const VERIFICATION_TTL_MIN = 60 * 24
const RESET_TTL_MIN = 60
const REFRESH_TTL_DAYS = 30

export interface AuthResult {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; status: UserStatus; isAdmin: boolean }
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Every new account gets a FREE subscription so allowance checks never hit null. */
async function createFreeSubscription(userId: string) {
  const periodEnd = new Date()
  periodEnd.setMonth(periodEnd.getMonth() + 1)
  return prisma.subscription.create({
    data: {
      userId,
      plan: Plan.FREE,
      status: SubscriptionStatus.ACTIVE,
      periodEnd,
    },
  })
}

async function issueRefreshToken(userId: string, userAgent?: string): Promise<string> {
  const { token, tokenHash } = generateToken(48)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  await prisma.refreshSession.create({
    data: { userId, tokenHash, expiresAt, userAgent: userAgent?.slice(0, 250) },
  })
  return token
}

async function buildAuthResult(
  user: { id: string; email: string; status: UserStatus; isAdmin: boolean },
  userAgent?: string,
): Promise<AuthResult> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, isAdmin: user.isAdmin })
  const refreshToken = await issueRefreshToken(user.id, userAgent)
  return { accessToken, refreshToken, user }
}

export async function register(emailRaw: string, password: string, locale = 'en') {
  const email = normaliseEmail(emailRaw)
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    // Do not confirm which addresses are registered.
    throw conflict('That email address cannot be used. Try signing in instead.')
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
  const user = await prisma.user.create({
    data: { email, passwordHash, locale, status: UserStatus.PENDING_VERIFICATION },
  })
  await createFreeSubscription(user.id)

  const { token, tokenHash } = generateToken()
  await prisma.authToken.create({
    data: {
      userId: user.id,
      purpose: TokenPurpose.EMAIL_VERIFICATION,
      tokenHash,
      expiresAt: expiresIn(VERIFICATION_TTL_MIN),
    },
  })

  const mail = verificationEmail(token)
  await sendMail(user.email, mail.subject, mail.text)
  logger.info({ userId: user.id }, 'user registered')

  return { id: user.id, email: user.email, status: user.status }
}

export async function verifyEmail(token: string) {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.purpose !== TokenPurpose.EMAIL_VERIFICATION) {
    throw badRequest('That confirmation link is not valid. Request a new one.')
  }
  if (record.usedAt) throw badRequest('That confirmation link has already been used.')
  if (record.expiresAt < new Date()) {
    throw badRequest('That confirmation link has expired. Request a new one.')
  }

  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { status: UserStatus.ACTIVE } }),
  ])

  return { verified: true }
}

export async function login(emailRaw: string, password: string, userAgent?: string): Promise<AuthResult> {
  const email = normaliseEmail(emailRaw)
  const user = await prisma.user.findUnique({ where: { email } })

  // Hash even when the user is missing so timing does not reveal registration.
  const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  let ok = false
  try {
    ok = await argon2.verify(hash, password)
  } catch {
    ok = false
  }

  if (!user || !user.passwordHash || !ok) throw unauthorized('Email or password is incorrect.')
  if (user.status === UserStatus.DELETED) throw unauthorized('Email or password is incorrect.')

  return buildAuthResult(
    { id: user.id, email: user.email, status: user.status, isAdmin: user.isAdmin },
    userAgent,
  )
}

/**
 * Rotates the refresh token: the presented one is revoked and a new one issued.
 * A replayed token therefore fails, which surfaces theft rather than hiding it.
 */
export async function refresh(presented: string, userAgent?: string): Promise<AuthResult> {
  const tokenHash = hashToken(presented)
  const session = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw unauthorized('Your session has expired. Sign in again.')
  }
  if (session.user.status === UserStatus.DELETED) throw unauthorized()

  await prisma.refreshSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  })

  return buildAuthResult(
    {
      id: session.user.id,
      email: session.user.email,
      status: session.user.status,
      isAdmin: session.user.isAdmin,
    },
    userAgent,
  )
}

export async function logout(presented: string): Promise<void> {
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashToken(presented), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = normaliseEmail(emailRaw)
  const user = await prisma.user.findUnique({ where: { email } })

  // Always return success to the caller; only send mail if the account exists.
  if (!user || user.status === UserStatus.DELETED) {
    logger.info({ email }, 'password reset requested for unknown address')
    return
  }

  const { token, tokenHash } = generateToken()
  await prisma.authToken.create({
    data: {
      userId: user.id,
      purpose: TokenPurpose.PASSWORD_RESET,
      tokenHash,
      expiresAt: expiresIn(RESET_TTL_MIN),
    },
  })

  const mail = resetEmail(token)
  await sendMail(user.email, mail.subject, mail.text)
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.purpose !== TokenPurpose.PASSWORD_RESET) {
    throw badRequest('That reset link is not valid. Request a new one.')
  }
  if (record.usedAt) throw badRequest('That reset link has already been used.')
  if (record.expiresAt < new Date()) throw badRequest('That reset link has expired. Request a new one.')

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id })

  await prisma.$transaction([
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Changing the password ends every existing session.
    prisma.refreshSession.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}

export async function currentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      isAdmin: true,
      createdAt: true,
      subscription: {
        select: { plan: true, status: true, videosUsed: true, periodEnd: true, cancelAtPeriodEnd: true },
      },
    },
  })
  if (!user) throw unauthorized()
  return user
}

/** FR-1.4 — soft delete, then release the address so it can be reused. */
export async function deleteAccount(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.DELETED,
        deletedAt: new Date(),
        passwordHash: null,
        email: `deleted+${userId}@invalid`,
      },
    }),
  ])
}

/** Exposed for tests that need a token without going through email. */
export function decodeAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET)
}
