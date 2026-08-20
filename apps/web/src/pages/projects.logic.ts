import { ApiFailure } from '../lib/errors.ts'

/**
 * Every plan caps duration at the same value — the tiers differ on videos per
 * month and channel count. Presented as a fixed constraint rather than an
 * upsell, matching the API, which is careful not to suggest an upgrade that
 * would not help.
 */
export const MAX_DURATION_SEC = 90

export const DURATION_CHOICES = [30, 45, 60, 90] as const

/**
 * Turns a create failure into something a creator can act on.
 *
 * Errors arrive nested as { error: { code, message } }. The server's own
 * messages are already written for this audience, so they are preferred over
 * anything invented here; only the unmatched case gets generic wording.
 */
export function createErrorMessage(error: unknown): string {
  if (error instanceof ApiFailure) {
    if (error.status === 403) {
      // Plan limit — the server names the cap and deliberately avoids promising
      // an upgrade that would not change it.
      return error.error.message
    }
    if (error.status === 404) {
      return 'That channel is no longer available. Pick a different one, or create the video without a channel.'
    }
    if (error.status === 400) {
      return error.error.message
    }
    if (error.status === 402) {
      return 'You have used every video on your plan for this period. Upgrade, or wait for it to renew.'
    }
    return error.error.message
  }
  return 'The video could not be created. Check your connection, then try again.'
}
