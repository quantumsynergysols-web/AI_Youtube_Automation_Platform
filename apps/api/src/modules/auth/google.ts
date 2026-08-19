import { OAuth2Client } from 'google-auth-library'
import { env } from '../../config/env'
import { AppError, badRequest, unauthorized } from '../../lib/errors'

export interface GoogleIdentity {
  googleId: string
  email: string
  emailVerified: boolean
  name?: string
}

let client: OAuth2Client | null = null

function oauthClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID) {
    // Configuration problem, not a caller problem — say so plainly rather than
    // returning a generic 401 that looks like the user's token was bad.
    throw new AppError(
      501,
      'google_signin_unavailable',
      'Google sign-in is not configured on this deployment.',
    )
  }
  client ??= new OAuth2Client(env.GOOGLE_CLIENT_ID)
  return client
}

/**
 * Verifies a Google ID token and returns the identity it asserts.
 *
 * `verifyIdToken` checks the signature against Google's published keys, the
 * issuer, the audience and the expiry. Everything downstream may assume the
 * token is genuine — but not that the email is verified, which is checked
 * separately at the point where it actually matters (account linking).
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const ticket = await oauthClient()
    .verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID! })
    .catch(() => {
      throw unauthorized('That Google sign-in could not be verified. Try again.')
    })

  const payload = ticket.getPayload()
  if (!payload?.sub) throw unauthorized('That Google sign-in could not be verified. Try again.')
  if (!payload.email) {
    throw badRequest('That Google account has no email address, so it cannot be used to sign in.')
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name,
  }
}

/** Exposed so tests can reset the memoised client between cases. */
export function __resetGoogleClient(): void {
  client = null
}
