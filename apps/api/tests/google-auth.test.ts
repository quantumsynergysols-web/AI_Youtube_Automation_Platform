import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserStatus } from '@prisma/client'

// Hermetic: both the database and Google's token verification are stubbed, so
// these tests exercise the linking decision table and nothing else.
const prismaMock = {
  user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  subscription: { create: vi.fn() },
  refreshSession: { create: vi.fn() },
}
const verifyGoogleIdToken = vi.fn()

vi.mock('../src/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../src/modules/auth/google', () => ({ verifyGoogleIdToken }))

const { signInWithGoogle } = await import('../src/modules/auth/auth.service')

const IDENTITY = {
  googleId: 'google-sub-123',
  email: 'creator@example.com',
  emailVerified: true,
  name: 'A Creator',
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: IDENTITY.email,
    googleId: null,
    passwordHash: 'argon2-hash',
    status: UserStatus.ACTIVE,
    isAdmin: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyGoogleIdToken.mockResolvedValue({ ...IDENTITY })
  prismaMock.refreshSession.create.mockResolvedValue({})
  prismaMock.subscription.create.mockResolvedValue({})
})

describe('signInWithGoogle — a googleId already linked', () => {
  it('signs the account in without touching the email lookup', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(user({ googleId: IDENTITY.googleId }))

    const result = await signInWithGoogle('token')

    expect(result.user.id).toBe('user-1')
    expect(result.accessToken).toBeTruthy()
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('refuses a deleted account', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(
      user({ googleId: IDENTITY.googleId, status: UserStatus.DELETED }),
    )
    await expect(signInWithGoogle('token')).rejects.toMatchObject({ status: 401 })
  })
})

describe('signInWithGoogle — linking to an existing email account', () => {
  it('links when Google says the address is verified', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(user())
    prismaMock.user.update.mockResolvedValue(user({ googleId: IDENTITY.googleId }))

    const result = await signInWithGoogle('token')

    expect(result.user.id).toBe('user-1')
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ googleId: IDENTITY.googleId }),
      }),
    )
  })

  it('activates an account that was still pending verification', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user({ status: UserStatus.PENDING_VERIFICATION }))
    prismaMock.user.update.mockResolvedValue(
      user({ googleId: IDENTITY.googleId, status: UserStatus.ACTIVE }),
    )

    await signInWithGoogle('token')

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: UserStatus.ACTIVE }),
      }),
    )
  })

  it('REFUSES to link when Google has not verified the address', async () => {
    // The account-takeover vector: without this check, anyone able to present a
    // token for an unverified address would inherit the matching password account.
    verifyGoogleIdToken.mockResolvedValue({ ...IDENTITY, emailVerified: false })
    prismaMock.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(user())

    await expect(signInWithGoogle('token')).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('refuses a deleted account found by email', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user({ status: UserStatus.DELETED }))

    await expect(signInWithGoogle('token')).rejects.toMatchObject({ status: 401 })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('signInWithGoogle — creating a new account', () => {
  it('creates an active, password-less account with a free subscription', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(
      user({ id: 'user-new', googleId: IDENTITY.googleId, passwordHash: null }),
    )

    const result = await signInWithGoogle('token')

    expect(result.user.id).toBe('user-new')
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: IDENTITY.email,
          googleId: IDENTITY.googleId,
          passwordHash: null,
          status: UserStatus.ACTIVE,
        }),
      }),
    )
    expect(prismaMock.subscription.create).toHaveBeenCalledTimes(1)
  })

  it('refuses to create an account for an unverified address', async () => {
    verifyGoogleIdToken.mockResolvedValue({ ...IDENTITY, emailVerified: false })
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(signInWithGoogle('token')).rejects.toMatchObject({ status: 403 })
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })
})

describe('signInWithGoogle — token verification', () => {
  it('propagates a verification failure rather than creating anything', async () => {
    verifyGoogleIdToken.mockRejectedValue(
      Object.assign(new Error('bad token'), { status: 401 }),
    )

    await expect(signInWithGoogle('token')).rejects.toThrow('bad token')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })
})
