import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret, __resetKeyCache } from '../src/lib/crypto'

const TOKEN = '1//0gLongLivedGoogleRefreshTokenExample_abcdefghijklmnop'

beforeEach(() => {
  __resetKeyCache()
})

describe('token encryption at rest (FR-2.2)', () => {
  it('round-trips a token unchanged', () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN)
  })

  it('round-trips unicode and empty input', () => {
    for (const value of ['', 'a', 'ٹوکن ۱۲۳', '🎬 emoji token', 'x'.repeat(4096)]) {
      expect(decryptSecret(encryptSecret(value))).toBe(value)
    }
  })

  it('produces a different ciphertext each time for the same plaintext', () => {
    // A fixed IV would make equal tokens produce equal ciphertexts, leaking
    // which accounts share a credential.
    const seen = new Set<string>()
    for (let i = 0; i < 25; i++) {
      seen.add(Buffer.from(encryptSecret(TOKEN)).toString('hex'))
    }
    expect(seen.size).toBe(25)
  })

  it('never stores the plaintext inside the envelope', () => {
    const hex = Buffer.from(encryptSecret(TOKEN)).toString('hex')
    expect(hex).not.toContain(Buffer.from(TOKEN, 'utf8').toString('hex'))
  })

  it('lays out the envelope as iv(12) + tag(16) + ciphertext', () => {
    const out = encryptSecret('abc')
    expect(out.length).toBe(12 + 16 + 3)
  })

  it('returns a Uint8Array backed by a plain ArrayBuffer, as Prisma Bytes requires', () => {
    const out = encryptSecret(TOKEN)
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.buffer).toBeInstanceOf(ArrayBuffer)
  })
})

describe('tamper detection', () => {
  it('rejects a modified ciphertext rather than returning altered plaintext', () => {
    const envelope = Buffer.from(encryptSecret(TOKEN))
    envelope[envelope.length - 1] ^= 0xff
    expect(() => decryptSecret(envelope)).toThrow()
  })

  it('rejects a modified authentication tag', () => {
    const envelope = Buffer.from(encryptSecret(TOKEN))
    envelope[13] ^= 0xff // inside the 16-byte tag
    expect(() => decryptSecret(envelope)).toThrow()
  })

  it('rejects a modified IV', () => {
    const envelope = Buffer.from(encryptSecret(TOKEN))
    envelope[0] ^= 0xff
    expect(() => decryptSecret(envelope)).toThrow()
  })

  it('rejects a truncated envelope instead of reading past the end', () => {
    const envelope = Buffer.from(encryptSecret(TOKEN))
    expect(() => decryptSecret(envelope.subarray(0, 20))).toThrow(/malformed or truncated/)
    expect(() => decryptSecret(Buffer.alloc(0))).toThrow(/malformed or truncated/)
  })

  it('cannot be decrypted with a different key', () => {
    const envelope = encryptSecret(TOKEN)
    const original = process.env.TOKEN_ENCRYPTION_KEY

    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    __resetKeyCache()
    // Rotating the key makes stored tokens unreadable — deliberate, and the
    // reason .env.example warns that rotation forces every channel to reconnect.
    expect(() => decryptSecret(envelope)).toThrow()

    process.env.TOKEN_ENCRYPTION_KEY = original
    __resetKeyCache()
  })
})

describe('key validation', () => {
  it('refuses a key that does not decode to 32 bytes rather than padding it', () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY

    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(16).toString('base64')
    __resetKeyCache()
    expect(() => encryptSecret('x')).toThrow(/exactly 32 bytes/)

    process.env.TOKEN_ENCRYPTION_KEY = original
    __resetKeyCache()
  })
})
