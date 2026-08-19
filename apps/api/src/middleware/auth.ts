import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { UserStatus } from '@prisma/client'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { forbidden, unauthorized } from '../lib/errors'

export interface AccessTokenClaims {
  sub: string
  email: string
  isAdmin: boolean
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenClaims
    }
  }
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenClaims
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) throw unauthorized()
    const token = header.slice('Bearer '.length)

    let claims: AccessTokenClaims
    try {
      claims = verifyAccessToken(token)
    } catch {
      throw unauthorized('Your session has expired. Sign in again.')
    }

    // A token stays valid until it expires, so re-check the account each time:
    // a suspended or deleted user must lose access immediately.
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, status: true },
    })
    if (!user || user.status === UserStatus.DELETED) throw unauthorized()
    if (user.status === UserStatus.SUSPENDED) {
      throw forbidden('This account is suspended. Contact support.')
    }
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw forbidden('Confirm your email address to continue.')
    }

    req.user = claims
    next()
  } catch (err) {
    next(err)
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) return next(forbidden('Administrator access required.'))
  next()
}
