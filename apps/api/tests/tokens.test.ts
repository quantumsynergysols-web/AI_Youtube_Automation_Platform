import { describe, expect, it } from 'vitest'
import { generateToken, hashToken, safeEqual, expiresIn } from '../src/lib/tokens'

describe('token helpers', () => {
  it('returns a token whose hash matches, and never stores the token itself', () => {
    const { token, tokenHash } = generateToken()
    expect(token).not.toEqual(tokenHash)
    expect(hashToken(token)).toEqual(tokenHash)
  })

  it('produces a distinct token every call', () => {
    const a = generateToken().token
    const b = generateToken().token
    expect(a).not.toEqual(b)
  })

  it('emits url-safe tokens so email links do not need escaping', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateToken().token).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('compares equal and unequal strings correctly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })

  it('expiresIn returns a future date', () => {
    const d = expiresIn(60)
    expect(d.getTime()).toBeGreaterThan(Date.now())
    expect(d.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60_000 + 50)
  })
})
