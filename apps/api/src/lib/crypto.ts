import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Envelope for OAuth tokens at rest (FR-2.2, NFR security).
 *
 * AES-256-GCM, because these values must be both secret and tamper-evident: a
 * modified ciphertext must fail rather than decrypt to something attacker-chosen.
 * A fresh random IV per encryption means the same token encrypts differently
 * every time, so equal ciphertexts never reveal equal plaintexts.
 *
 * Stored layout, one Buffer for the Bytes column:
 *
 *   [ 12-byte IV ][ 16-byte auth tag ][ ciphertext ]
 */
const IV_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

let cachedKey: Buffer | null = null

function key(): Buffer {
  if (cachedKey) return cachedKey

  // Read from process.env at call time rather than the parsed env object: the
  // key can be rotated without a redeploy, and it keeps this module testable.
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32',
    )
  }

  const decoded = Buffer.from(raw, 'base64')
  if (decoded.length !== KEY_BYTES) {
    // Refuse a short key rather than silently padding it — a 16-byte key here
    // would quietly downgrade the cipher.
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes, got ${decoded.length}. ` +
        'Generate one with: openssl rand -base64 32',
    )
  }

  cachedKey = decoded
  return cachedKey
}

// Returns Uint8Array rather than Buffer: Prisma's Bytes column is typed
// Uint8Array<ArrayBuffer>, and Buffer is ArrayBufferLike, which does not satisfy it.
export function encryptSecret(plaintext: string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const envelope = Buffer.concat([iv, cipher.getAuthTag(), ciphertext])

  // Copy into a freshly allocated ArrayBuffer. A Buffer is a view over a pooled
  // ArrayBufferLike, which does not satisfy Prisma's Uint8Array<ArrayBuffer>.
  const out = new Uint8Array(new ArrayBuffer(envelope.length))
  out.set(envelope)
  return out
}

export function decryptSecret(envelope: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(envelope) ? envelope : Buffer.from(envelope)
  // An empty plaintext is a legitimate 28-byte envelope (iv + tag + nothing),
  // so the boundary is < rather than <=.
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error('Encrypted value is malformed or truncated.')
  }

  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  // decipher.final() throws if the tag does not verify, which is the point.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/** Test seam so a suite can install a known key without touching process env twice. */
export function __resetKeyCache(): void {
  cachedKey = null
}
