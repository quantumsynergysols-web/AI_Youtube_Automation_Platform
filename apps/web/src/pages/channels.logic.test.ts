import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
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
    const limit = { status: 403, error: { message: 'The Free plan allows 1 connected channel.' } }
    assert.match(connectError(limit), /Review plans in Billing/)
    const unavailable = { status: 501, error: { message: 'raw' } }
    assert.match(connectError(unavailable), /not available on this deployment/)
  })

  it('does not expose raw list errors', () => {
    assert.equal(channelLoadError(new Error('database details')), 'Channels could not be loaded. Check your connection and try again.')
  })
})
