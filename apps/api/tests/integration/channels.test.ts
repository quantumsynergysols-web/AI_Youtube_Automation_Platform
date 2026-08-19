import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { JobStage, JobStatus, Plan, SubscriptionStatus, UserStatus } from '@prisma/client'
import { badRequest } from '../../src/lib/errors'

const oauth = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  fetchChannel: vi.fn(),
  refreshAccessToken: vi.fn(),
  revokeToken: vi.fn(),
  fetchUploadsPlaylistId: vi.fn(),
  fetchPlaylistPage: vi.fn(),
}))

vi.mock('../../src/modules/channels/youtube-oauth', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/modules/channels/youtube-oauth')>()
  return { ...original, ...oauth }
})

import { prisma } from '../../src/lib/prisma'
import { redis } from '../../src/lib/redis'
import { decryptSecret, encryptSecret } from '../../src/lib/crypto'
import {
  accessTokenFor,
  assertOwnsChannel,
  completeConnect,
  disconnect,
  startConnect,
} from '../../src/modules/channels/channels.service'
import { importChannelHistory } from '../../src/modules/channels/history.service'
import { buildAuthUrl, consumeState, SCOPES } from '../../src/modules/channels/youtube-oauth'

function opaque(label: string): string {
  return `${label}-${randomUUID()}`
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

async function createUser(plan: Plan = Plan.FREE) {
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  return prisma.user.create({
    data: {
      email: `channel.${randomUUID()}@example.test`,
      status: UserStatus.ACTIVE,
      subscription: {
        create: { plan, status: SubscriptionStatus.ACTIVE, periodEnd },
      },
    },
  })
}

async function createChannel(
  userId: string,
  options: { youtubeChannelId?: string; accessToken?: string; refreshToken?: string; expiresAt?: Date } = {},
) {
  const accessToken = options.accessToken ?? opaque('access')
  const refreshToken = options.refreshToken ?? opaque('refresh')
  const channel = await prisma.channel.create({
    data: {
      userId,
      youtubeChannelId: options.youtubeChannelId ?? opaque('youtube-channel'),
      title: `Channel ${randomUUID()}`,
      oauthTokenEnc: encryptSecret(accessToken),
      refreshTokenEnc: encryptSecret(refreshToken),
      tokenExpiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      grantedScopes: [...SCOPES],
    },
  })
  return { channel, accessToken, refreshToken }
}

async function stateFor(userId: string): Promise<string> {
  return (await buildAuthUrl(userId)).state
}

async function waitForBackgroundImport(channelId: string): Promise<void> {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    const job = await prisma.renderJob.findFirst({
      where: { payload: { path: ['channelId'], equals: channelId } },
      orderBy: { enqueuedAt: 'desc' },
    })
    if (job && (job.status === JobStatus.SUCCEEDED || job.status === JobStatus.FAILED)) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Background import did not finish for channel ${channelId}`)
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`
  if (redis.status === 'wait') await redis.connect()
  expect(await redis.ping()).toBe('PONG')
})

beforeEach(async () => {
  await truncateDatabase()
  await redis.flushdb()
  vi.clearAllMocks()

  oauth.exchangeCode.mockResolvedValue({
    accessToken: opaque('issued-access'),
    refreshToken: opaque('issued-refresh'),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    grantedScopes: [...SCOPES],
  })
  oauth.fetchChannel.mockResolvedValue({
    channelId: opaque('youtube-channel'),
    title: 'Integration Channel',
    thumbnailUrl: null,
    subscriberCount: 321,
    videoCount: 45,
  })
  oauth.fetchUploadsPlaylistId.mockResolvedValue(opaque('uploads-playlist'))
  oauth.fetchPlaylistPage.mockResolvedValue({ videos: [], nextPageToken: null, totalResults: 0 })
  oauth.revokeToken.mockResolvedValue(undefined)
})

afterAll(async () => {
  await prisma.$disconnect()
  if (redis.status !== 'end') await redis.quit()
})

describe('DB-backed channel connection and history import', () => {
  it('stores both OAuth tokens encrypted and decrypts them back to the issued values', async () => {
    const user = await createUser()
    const accessToken = opaque('issued-access')
    const refreshToken = opaque('issued-refresh')
    oauth.exchangeCode.mockResolvedValue({
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      grantedScopes: [...SCOPES],
    })

    const connected = await completeConnect(opaque('authorization-code'), await stateFor(user.id))
    const row = await prisma.channel.findUniqueOrThrow({ where: { id: connected.id } })
    const accessCiphertext = Buffer.from(row.oauthTokenEnc!)
    const refreshCiphertext = Buffer.from(row.refreshTokenEnc!)

    expect(accessCiphertext.includes(Buffer.from(accessToken))).toBe(false)
    expect(refreshCiphertext.includes(Buffer.from(refreshToken))).toBe(false)
    expect(decryptSecret(accessCiphertext)).toBe(accessToken)
    expect(decryptSecret(refreshCiphertext)).toBe(refreshToken)
    await waitForBackgroundImport(connected.id)
  })

  it('consumes OAuth state once and rejects its replay', async () => {
    const user = await createUser()
    const state = await stateFor(user.id)

    await expect(consumeState(state)).resolves.toBe(user.id)
    await expect(consumeState(state)).rejects.toMatchObject({ status: 400, code: 'bad_request' })
  })

  it('refuses a partial scope grant without creating a channel', async () => {
    const user = await createUser()
    oauth.exchangeCode.mockRejectedValue(
      badRequest('Some permissions were not granted, so the channel cannot be connected.'),
    )

    await expect(completeConnect(opaque('authorization-code'), await stateFor(user.id)))
      .rejects.toMatchObject({ status: 400 })
    expect(await prisma.channel.count()).toBe(0)
  })

  it('refuses a grant with no refresh token without creating a channel', async () => {
    const user = await createUser()
    oauth.exchangeCode.mockResolvedValue({
      accessToken: opaque('issued-access'),
      refreshToken: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      grantedScopes: [...SCOPES],
    })

    await expect(completeConnect(opaque('authorization-code'), await stateFor(user.id)))
      .rejects.toMatchObject({ status: 400 })
    expect(await prisma.channel.count()).toBe(0)
  })

  it('re-checks the FREE channel limit when completing a previously started connection', async () => {
    const user = await createUser()
    const started = await startConnect(user.id)
    const state = new URL(started.url).searchParams.get('state')
    expect(state).toEqual(expect.any(String))
    await createChannel(user.id)

    await expect(completeConnect(opaque('authorization-code'), state!))
      .rejects.toMatchObject({ status: 403, code: 'forbidden' })
    expect(oauth.exchangeCode).not.toHaveBeenCalled()
  })

  it('returns conflict for a channel already connected to this user or another user', async () => {
    const owner = await createUser(Plan.PRO)
    const other = await createUser(Plan.PRO)
    const youtubeChannelId = opaque('duplicate-channel')
    await createChannel(owner.id, { youtubeChannelId })
    oauth.fetchChannel.mockResolvedValue({
      channelId: youtubeChannelId,
      title: 'Duplicate Channel',
      thumbnailUrl: null,
      subscriberCount: null,
      videoCount: null,
    })

    await expect(completeConnect(opaque('code'), await stateFor(owner.id)))
      .rejects.toMatchObject({ status: 409, code: 'conflict', message: 'That channel is already connected.' })
    await expect(completeConnect(opaque('code'), await stateFor(other.id)))
      .rejects.toMatchObject({ status: 409, code: 'conflict', message: 'That YouTube channel is already connected to another account.' })
  })

  it('returns a valid stored token, then refreshes expiry and replaces access ciphertext', async () => {
    const user = await createUser()
    const stored = await createChannel(user.id)
    const beforeCiphertext = Buffer.from(stored.channel.oauthTokenEnc!)

    await expect(accessTokenFor(stored.channel.id)).resolves.toBe(stored.accessToken)
    expect(oauth.refreshAccessToken).not.toHaveBeenCalled()

    await prisma.channel.update({
      where: { id: stored.channel.id },
      data: { tokenExpiresAt: new Date(Date.now() - 60_000) },
    })
    const refreshedAccessToken = opaque('refreshed-access')
    oauth.refreshAccessToken.mockResolvedValue({
      accessToken: refreshedAccessToken,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      grantedScopes: [...SCOPES],
    })

    await expect(accessTokenFor(stored.channel.id)).resolves.toBe(refreshedAccessToken)
    const after = await prisma.channel.findUniqueOrThrow({ where: { id: stored.channel.id } })
    expect(Buffer.from(after.oauthTokenEnc!)).not.toEqual(beforeCiphertext)
    expect(decryptSecret(after.oauthTokenEnc!)).toBe(refreshedAccessToken)
    expect(after.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now())
    expect(after.lastRefreshedAt).toBeInstanceOf(Date)
    expect(oauth.refreshAccessToken).toHaveBeenCalledWith(stored.refreshToken)
  })

  it('preserves the stored refresh token when Google omits one during refresh', async () => {
    const user = await createUser()
    const stored = await createChannel(user.id, { expiresAt: new Date(Date.now() - 60_000) })
    const refreshCiphertext = Buffer.from(stored.channel.refreshTokenEnc!)
    oauth.refreshAccessToken.mockResolvedValue({
      accessToken: opaque('refreshed-access'),
      refreshToken: null,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      grantedScopes: [...SCOPES],
    })

    await accessTokenFor(stored.channel.id)
    const after = await prisma.channel.findUniqueOrThrow({ where: { id: stored.channel.id } })
    expect(Buffer.from(after.refreshTokenEnc!)).toEqual(refreshCiphertext)
    expect(decryptSecret(after.refreshTokenEnc!)).toBe(stored.refreshToken)
  })

  it('revokes the grant, deletes the channel, and preserves projects with a null channelId', async () => {
    const user = await createUser()
    const stored = await createChannel(user.id)
    const project = await prisma.project.create({
      data: { userId: user.id, channelId: stored.channel.id, topic: 'Integration project' },
    })

    await disconnect(user.id, stored.channel.id)

    expect(oauth.revokeToken).toHaveBeenCalledWith(stored.refreshToken)
    expect(await prisma.channel.findUnique({ where: { id: stored.channel.id } })).toBeNull()
    expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
      .toMatchObject({ channelId: null, topic: 'Integration project' })
  })

  it('returns 404 when another user asks about a channel they do not own', async () => {
    const owner = await createUser()
    const other = await createUser()
    const stored = await createChannel(owner.id)

    await expect(assertOwnsChannel(other.id, stored.channel.id))
      .rejects.toMatchObject({ status: 404, code: 'not_found', message: 'No such channel.' })
  })

  it('imports every video across pages and records a SUCCEEDED IMPORT job', async () => {
    const user = await createUser()
    const stored = await createChannel(user.id)
    const videos = [
      { youtubeVideoId: opaque('video'), title: 'First', description: 'One', publishedAt: new Date('2026-01-01') },
      { youtubeVideoId: opaque('video'), title: 'Second', description: 'Two', publishedAt: new Date('2026-02-01') },
      { youtubeVideoId: opaque('video'), title: 'Third', description: null, publishedAt: new Date('2026-03-01') },
    ]
    oauth.fetchPlaylistPage
      .mockResolvedValueOnce({ videos: videos.slice(0, 2), nextPageToken: 'page-two', totalResults: 3 })
      .mockResolvedValueOnce({ videos: videos.slice(2), nextPageToken: null, totalResults: 3 })

    await expect(importChannelHistory(stored.channel.id)).resolves.toEqual({
      imported: 3, updated: 0, pages: 2, truncated: false,
    })
    expect(await prisma.channelVideo.count({ where: { channelId: stored.channel.id } })).toBe(3)
    expect(oauth.fetchPlaylistPage).toHaveBeenNthCalledWith(1, stored.accessToken, expect.any(String), null)
    expect(oauth.fetchPlaylistPage).toHaveBeenNthCalledWith(2, stored.accessToken, expect.any(String), 'page-two')

    const job = await prisma.renderJob.findFirstOrThrow({ where: { userId: user.id, stage: JobStage.IMPORT } })
    expect(job).toMatchObject({ status: JobStatus.SUCCEEDED, error: null })
    expect(job.result).toEqual({ imported: 3, updated: 0, pages: 2, truncated: false })
  })

  it('re-imports idempotently by updating titles and reporting updated counts', async () => {
    const user = await createUser()
    const stored = await createChannel(user.id)
    const youtubeVideoId = opaque('video')
    const publishedAt = new Date('2026-04-01')
    oauth.fetchPlaylistPage.mockResolvedValue({
      videos: [{ youtubeVideoId, title: 'Original title', description: null, publishedAt }],
      nextPageToken: null,
      totalResults: 1,
    })
    await expect(importChannelHistory(stored.channel.id)).resolves.toMatchObject({ imported: 1, updated: 0 })

    oauth.fetchPlaylistPage.mockResolvedValue({
      videos: [{ youtubeVideoId, title: 'Updated title', description: 'Changed', publishedAt }],
      nextPageToken: null,
      totalResults: 1,
    })
    await expect(importChannelHistory(stored.channel.id)).resolves.toMatchObject({ imported: 0, updated: 1 })

    expect(await prisma.channelVideo.count({ where: { channelId: stored.channel.id } })).toBe(1)
    expect(await prisma.channelVideo.findFirstOrThrow({ where: { channelId: stored.channel.id } }))
      .toMatchObject({ youtubeVideoId, title: 'Updated title', description: 'Changed' })
  })

  it('records a FAILED IMPORT job with the provider error when page fetching fails', async () => {
    const user = await createUser()
    const stored = await createChannel(user.id)
    const providerError = `history-page-failure-${randomUUID()}`
    oauth.fetchPlaylistPage.mockRejectedValue(new Error(providerError))

    await expect(importChannelHistory(stored.channel.id)).rejects.toThrow(providerError)
    const job = await prisma.renderJob.findFirstOrThrow({ where: { userId: user.id, stage: JobStage.IMPORT } })
    expect(job).toMatchObject({ status: JobStatus.FAILED, error: providerError })
    expect(job.finishedAt).toBeInstanceOf(Date)
  })
})
