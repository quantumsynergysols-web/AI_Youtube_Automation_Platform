import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiFailure } from '../lib/errors.ts'
import { ActiveTimeAccumulator, generationError } from './script-review.logic.ts'

describe('script review evidence', () => {
  it('emits non-overlapping humanInputMs deltas', () => {
    let now = 0
    const timer = new ActiveTimeAccumulator(() => now)
    timer.resume()
    now = 1_250
    assert.equal(timer.consume(), 1_250)
    now = 2_000
    assert.equal(timer.consume(), 750)
  })

  it('does not count time while visibility is paused', () => {
    let now = 100
    const timer = new ActiveTimeAccumulator(() => now)
    timer.resume()
    now = 600
    timer.pause()
    now = 60_600
    assert.equal(timer.consume(), 500)
    timer.resume()
    now = 61_000
    assert.equal(timer.consume(), 400)
  })

  it('gives each provider failure distinct guidance', () => {
    const unavailable = generationError(new ApiFailure(501, { code: 'provider_not_configured', message: 'raw' }))
    const refused = generationError(new ApiFailure(422, { code: 'provider_refused', message: 'raw' }))
    const malformed = generationError(new ApiFailure(502, { code: 'provider_bad_output', message: 'raw' }))
    assert.match(unavailable, /operator.*ANTHROPIC_API_KEY/i)
    assert.match(refused, /Rephrase/i)
    assert.match(malformed, /Generate again/i)
    assert.equal(new Set([unavailable, refused, malformed]).size, 3)
  })

  it('only recommends retrying failures that may succeed on retry', () => {
    const missing = generationError(new ApiFailure(404, { code: 'not_found', message: 'No such project.' }))
    const server = generationError(new ApiFailure(503, { code: 'unavailable', message: 'Provider temporarily unavailable.' }))
    assert.equal(missing, 'No such project.')
    assert.match(server, /Try generating again/)
  })
})
