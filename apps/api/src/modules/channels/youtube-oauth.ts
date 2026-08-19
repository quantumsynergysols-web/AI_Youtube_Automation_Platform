import { randomBytes } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { env } from '../../config/env'
import { redis } from '../../lib/redis'
import { logger } from '../../lib/logger'
import { AppError, badRequest, unauthorized } from '../../lib/errors'

/**
 * Channel connection uses the authorization **code** flow, not the ID-token flow
 * that FR-1.2 sign-in uses. Connecting a channel needs to act on the creator's
 * behalf while they are not present, which requires a refresh token, which
 * requires `access_type=offline`.
 *
 * All three scopes are requested at connect time rather than incrementally.
 * Incremental consent would mean a second consent screen mid-workflow and a
 * second Google verification review, both worse than asking once and explaining
 * why on our own screen beforehand.
 */
export const SCOPES = [
  // channel identity and back catalogue — FR-2.5 history import, FR-9 duplicate check
  'https://www.googleapis.com/auth/youtube.readonly',
  // retention, CTR and view duration — FR-11 analytics loop
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  // publishing — FR-10
  'https://www.googleapis.com/auth/youtube.upload',
] as const

const STATE_TTL_SECONDS = 600
const stateKey = (state: string) => `oauth:state:${state}`

export interface GoogleTokens {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
  grantedScopes: string[]
}

export interface YouTubeChannel {
  channelId: string
  title: string
  thumbnailUrl: string | null
  subscriberCount: number | null
  videoCount: number | null
}

function client(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new AppError(
      501,
      'channel_connect_unavailable',
      'Channel connection is not configured on this deployment.',
    )
  }
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  })
}

/**
 * Issues the consent URL plus a one-time state value bound to this user.
 *
 * The state is stored server-side rather than signed into the URL so it can be
 * deleted on use — that makes it single-use, which a signed value alone is not.
 */
export async function buildAuthUrl(userId: string): Promise<{ url: string; state: string }> {
  const state = randomBytes(24).toString('base64url')
  await redis.set(stateKey(state), userId, 'EX', STATE_TTL_SECONDS)

  const url = client().generateAuthUrl({
    access_type: 'offline',
    scope: [...SCOPES],
    state,
    // Without this Google omits the refresh token on every grant after the
    // first, and the connection silently cannot be renewed.
    prompt: 'consent',
    include_granted_scopes: true,
  })

  return { url, state }
}

/** Consumes the state, returning the user it was issued to. Single use. */
export async function consumeState(state: string): Promise<string> {
  const userId = await redis.getdel(stateKey(state))
  if (!userId) {
    throw badRequest('That connection link has expired or was already used. Start again.')
  }
  return userId
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const { tokens } = await client()
    .getToken(code)
    .catch((err: unknown) => {
      logger.warn({ err }, 'youtube code exchange failed')
      throw badRequest('Google rejected that authorisation. Try connecting again.')
    })

  if (!tokens.access_token) {
    throw badRequest('Google did not return an access token. Try connecting again.')
  }

  const granted = (tokens.scope ?? '').split(' ').filter(Boolean)
  const missing = SCOPES.filter((s) => !granted.includes(s))
  if (missing.length > 0) {
    // Google's consent screen lets a user untick scopes. Refuse a partial grant
    // rather than storing a connection that fails later at upload time.
    throw badRequest(
      'Some permissions were not granted, so the channel cannot be connected. Accept all requested permissions and try again.',
      { missing },
    )
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3_600_000),
    grantedScopes: granted,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const c = client()
  c.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await c.refreshAccessToken().catch((err: unknown) => {
    logger.warn({ err }, 'youtube token refresh failed')
    throw unauthorized('This channel needs to be reconnected. Its access has expired or was revoked.')
  })

  if (!credentials.access_token) {
    throw unauthorized('This channel needs to be reconnected.')
  }

  return {
    accessToken: credentials.access_token,
    // Google usually omits the refresh token on refresh; keep the existing one.
    refreshToken: credentials.refresh_token ?? null,
    expiresAt: new Date(credentials.expiry_date ?? Date.now() + 3_600_000),
    grantedScopes: (credentials.scope ?? '').split(' ').filter(Boolean),
  }
}

/** FR-2.4 — tell Google to drop the grant, not just forget it locally. */
export async function revokeToken(token: string): Promise<void> {
  const res = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => null)

  // A failed revoke must not block local disconnection; the user asked to
  // disconnect and the local grant is what our code honours.
  if (!res?.ok) {
    logger.warn({ status: res?.status }, 'google token revoke did not succeed; disconnecting locally anyway')
  }
}

export async function fetchChannel(accessToken: string): Promise<YouTubeChannel> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet,statistics')
  url.searchParams.set('mine', 'true')

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    logger.warn({ status: res.status }, 'youtube channels.list failed')
    throw badRequest('Could not read that YouTube channel. Try connecting again.')
  }

  const body = (await res.json()) as {
    items?: Array<{
      id: string
      snippet?: { title?: string; thumbnails?: { default?: { url?: string } } }
      statistics?: { subscriberCount?: string; videoCount?: string }
    }>
  }

  const item = body.items?.[0]
  if (!item) {
    throw badRequest('That Google account has no YouTube channel. Create one, then connect again.')
  }

  const num = (v: string | undefined) => (v === undefined ? null : Number.parseInt(v, 10))

  return {
    channelId: item.id,
    title: item.snippet?.title ?? 'Untitled channel',
    thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? null,
    subscriberCount: num(item.statistics?.subscriberCount),
    videoCount: num(item.statistics?.videoCount),
  }
}
