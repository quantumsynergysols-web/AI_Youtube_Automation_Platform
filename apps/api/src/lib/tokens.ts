import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Returns the token to send to the user and the hash to persist. */
export function generateToken(bytes = 32): { token: string; tokenHash: string } {
  const token = randomBytes(bytes).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export function expiresIn(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000)
}
