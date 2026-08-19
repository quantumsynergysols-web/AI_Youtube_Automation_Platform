import { ApiFailure } from '../lib/errors.ts'

export interface ChannelNotice {
  tone: 'ok' | 'info' | 'error'
  message: string
}

export function formatChannelCount(value: number | null): string {
  return value === null ? 'Not available' : new Intl.NumberFormat('en-US').format(value)
}

export function channelLoadError(error: unknown): string {
  if (error instanceof ApiFailure && error.status === 401) {
    return 'Your session ended before channels could load. Sign in again, then return here.'
  }
  return 'Channels could not be loaded. Check your connection and try again.'
}

export function callbackNotice(search: string): ChannelNotice | null {
  const params = new URLSearchParams(search)
  const outcome = params.get('connected')
  if (outcome === 'success') {
    const title = params.get('channel')
    return { tone: 'ok', message: title ? `${title} is connected and ready to use.` : 'Your YouTube channel is connected and ready to use.' }
  }
  if (outcome === 'cancelled') {
    return { tone: 'info', message: 'Channel connection was cancelled. No permissions were granted; connect whenever you are ready.' }
  }
  if (outcome === 'error') {
    const reason = params.get('reason')
    const message = reason === 'missing_code'
      ? 'Google returned without completing the connection. Start again and accept all requested permissions.'
      : reason || 'The channel could not be connected. Try the connection again.'
    return { tone: 'error', message }
  }
  return null
}

export function connectError(error: unknown): string {
  if (error instanceof ApiFailure && error.status === 403) {
    return `${error.error.message} Review plans in Billing to connect more channels.`
  }
  if (error instanceof ApiFailure && error.status === 501) {
    return 'Channel connection is not available on this deployment. Ask the deployment administrator to configure Google channel access.'
  }
  return 'The Google connection could not be started. Check your connection and try again.'
}
