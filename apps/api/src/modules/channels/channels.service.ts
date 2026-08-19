import type { Channel } from '@prisma/client'
import { prisma } from '../../lib/prisma'
import { logger } from '../../lib/logger'
import { encryptSecret, decryptSecret } from '../../lib/crypto'
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors'
import { planDefinition } from '../../config/plans'
import { importChannelHistoryInBackground } from './history.service'
import {
  buildAuthUrl,
  consumeState,
  exchangeCode,
  fetchChannel,
  refreshAccessToken,
  revokeToken,
} from './youtube-oauth'

/** Refresh this far before actual expiry so a job never starts on a token about to die. */
const REFRESH_SKEW_MS = 5 * 60_000

export interface ChannelView {
  id: string
  youtubeChannelId: string
  title: string
  thumbnailUrl: string | null
  subscriberCount: number | null
  videoCount: number | null
  connectedAt: Date
  baselineAt: Date | null
}

function toView(c: Channel): ChannelView {
  return {
    id: c.id,
    youtubeChannelId: c.youtubeChannelId,
    title: c.title,
    thumbnailUrl: c.thumbnailUrl,
    subscriberCount: c.subscriberCount,
    videoCount: c.videoCount,
    connectedAt: c.connectedAt,
    baselineAt: c.baselineAt,
  }
}

export async function listChannels(userId: string): Promise<ChannelView[]> {
  const rows = await prisma.channel.findMany({
    where: { userId },
    orderBy: { connectedAt: 'asc' },
  })
  return rows.map(toView)
}

/** FR-2.3 — the plan caps how many channels an account may connect. */
async function assertChannelSlotAvailable(userId: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({ where: { userId } })
  if (!sub) throw notFound('No subscription for this account.')

  const limit = planDefinition(sub.plan).channels
  const used = await prisma.channel.count({ where: { userId } })

  if (used >= limit) {
    throw forbidden(
      `The ${planDefinition(sub.plan).name} plan allows ${limit} connected ${limit === 1 ? 'channel' : 'channels'}. Disconnect one or upgrade to add another.`,
    )
  }
}

/** Shared ownership check so routes never trust a channel id from the URL. */
export async function assertOwnsChannel(userId: string, channelId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { userId: true },
  })
  // Same response whether it is missing or someone else's: do not confirm existence.
  if (!channel || channel.userId !== userId) throw notFound('No such channel.')
}

export async function startConnect(userId: string): Promise<{ url: string }> {
  await assertChannelSlotAvailable(userId)
  const { url } = await buildAuthUrl(userId)
  return { url }
}

/**
 * FR-2.1 / FR-2.2 / FR-2.5. Exchanges the code, reads the channel, and stores the
 * tokens encrypted along with a baseline of where the channel stands today.
 */
export async function completeConnect(code: string, state: string): Promise<ChannelView> {
  const userId = await consumeState(state)

  // Re-check the limit here as well as at start: the two requests are minutes
  // apart and the account may have connected another channel in between.
  await assertChannelSlotAvailable(userId)

  const tokens = await exchangeCode(code)
  if (!tokens.refreshToken) {
    // Without a refresh token the connection dies in an hour and cannot renew.
    throw badRequest(
      'Google did not return a long-lived token. Remove this app from your Google account permissions, then connect again.',
    )
  }

  const channel = await fetchChannel(tokens.accessToken)

  const existing = await prisma.channel.findUnique({
    where: { youtubeChannelId: channel.channelId },
  })
  if (existing) {
    if (existing.userId !== userId) {
      throw conflict('That YouTube channel is already connected to another account.')
    }
    throw conflict('That channel is already connected.')
  }

  const created = await prisma.channel.create({
    data: {
      userId,
      youtubeChannelId: channel.channelId,
      title: channel.title,
      thumbnailUrl: channel.thumbnailUrl,
      oauthTokenEnc: encryptSecret(tokens.accessToken),
      refreshTokenEnc: encryptSecret(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      grantedScopes: tokens.grantedScopes,
      subscriberCount: channel.subscriberCount,
      videoCount: channel.videoCount,
      baselineAt: new Date(),
    },
  })

  logger.info({ userId, channelId: created.id }, 'channel connected')

  // FR-2.5 — the catalogue is needed by FR-9, but the creator should not wait
  // for it and a failure here must not fail the connection.
  importChannelHistoryInBackground(created.id)

  return toView(created)
}

/**
 * Returns a usable access token for a channel, refreshing first if it is expired
 * or close to it. This is the path gate G1 means by "tokens survive a refresh
 * cycle" — nothing else in the system should read the stored token directly.
 */
export async function accessTokenFor(channelId: string): Promise<string> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel) throw notFound('No such channel.')
  if (!channel.oauthTokenEnc || !channel.refreshTokenEnc) {
    throw badRequest('That channel has no stored credentials. Reconnect it.')
  }

  const stillValid =
    channel.tokenExpiresAt && channel.tokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now()

  if (stillValid) return decryptSecret(channel.oauthTokenEnc)

  const refreshed = await refreshAccessToken(decryptSecret(channel.refreshTokenEnc))

  await prisma.channel.update({
    where: { id: channel.id },
    data: {
      oauthTokenEnc: encryptSecret(refreshed.accessToken),
      // Google usually omits the refresh token on renewal; keep the one we have.
      ...(refreshed.refreshToken
        ? { refreshTokenEnc: encryptSecret(refreshed.refreshToken) }
        : {}),
      tokenExpiresAt: refreshed.expiresAt,
      lastRefreshedAt: new Date(),
    },
  })

  logger.info({ channelId: channel.id }, 'channel access token refreshed')
  return refreshed.accessToken
}

/**
 * FR-2.4. Revokes the grant at Google, then removes the row.
 *
 * The row is deleted rather than soft-deleted so the channel can be connected
 * again later — `youtubeChannelId` is globally unique to stop two accounts
 * automating the same channel and double-posting to it. Projects that referenced
 * it keep working; their `channelId` is set to null by the schema.
 */
export async function disconnect(userId: string, channelId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel || channel.userId !== userId) throw notFound('No such channel.')

  if (channel.refreshTokenEnc) {
    await revokeToken(decryptSecret(channel.refreshTokenEnc))
  }

  await prisma.channel.delete({ where: { id: channel.id } })
  logger.info({ userId, channelId }, 'channel disconnected')
}
