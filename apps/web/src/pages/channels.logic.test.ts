import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { actionErrorMessage, ApiFailure } from '../lib/errors.ts'
import { callbackNotice, channelLoadError, connectError, formatChannelCount } from './channels.logic.ts'

describe('channel screen state copy', () => {
  it('formats metrics and missing values', () => {
    assert.equal(formatChannelCount(12500), '12,500')
    assert.equal(formatChannelCount(null), 'Not available')
  })

  it('maps all callback outcomes to clear notices', () => {
    assert.deepEqual(callbackNotice('?connected=success&channel=Creator%20Lab'), { tone: 'ok', message: 'Creator Lab is connected and ready to use.' })
    assert.match(callbackNotice('?connected=cancelled')!.message, /No permissions were granted/)
    assert.equal(callbackNotice('?connected=error&reason=Google%20rejected%20access')!.message, 'Google rejected access')
    assert.match(callbackNotice('?connected=error&reason=missing_code')!.message, /Start again/)
    assert.equal(callbackNotice(''), null)
  })

  it('turns plan-limit and unavailable responses into actionable copy', () => {
    const limit = new ApiFailure(403, { code: 'forbidden', message: 'The Free plan allows 1 connected channel.' })
    assert.match(connectError(limit), /Review plans in Billing/)
    const unavailable = new ApiFailure(501, { code: 'channel_connect_unavailable', message: 'raw' })
    assert.match(connectError(unavailable), /not available on this deployment/)
  })

  it('does not expose raw list errors', () => {
    assert.equal(channelLoadError(new Error('database details')), 'Channels could not be loaded. Check your connection and try again.')
  })

  it('keeps actionable server billing errors before UI guidance', () => {
    const error = new ApiFailure(400, { code: 'bad_request', message: 'No Stripe price is configured for the CREATOR plan.' })
    assert.equal(
      actionErrorMessage(error, 'Checkout could not be opened.', 'Confirm billing is configured, then try again.'),
      'No Stripe price is configured for the CREATOR plan. Confirm billing is configured, then try again.',
    )
  })
})
