import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiFailure } from '../lib/errors.ts'
import { DURATION_CHOICES, MAX_DURATION_SEC, createErrorMessage } from './projects.logic.ts'
import { nextAction, type ProjectSummary } from './dashboard.logic.ts'

function project(over: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: 'p1',
    topic: 'a topic',
    state: 'DRAFT',
    targetDurationSec: 60,
    createdAt: new Date().toISOString(),
    channel: null,
    script: null,
    originalityCheck: null,
    ...over,
  }
}

describe('project creation form', () => {
  it('offers no duration above the plan-wide cap', () => {
    // Every tier caps at the same value, so a longer option in the picker would
    // only produce a 403 the creator could have been spared.
    for (const choice of DURATION_CHOICES) assert.ok(choice <= MAX_DURATION_SEC)
  })

  it('passes the server plan message through rather than inventing one', () => {
    // The API is deliberately careful not to promise an upgrade that would not
    // help; rewording it here would undo that.
    const message = createErrorMessage(
      new ApiFailure(403, { code: 'forbidden', message: 'Videos are capped at 90 seconds on every plan.' }),
    )
    assert.match(message, /capped at 90 seconds on every plan/)
    assert.doesNotMatch(message, /upgrade/i)
  })

  it('explains a stale channel instead of showing a bare not-found', () => {
    const message = createErrorMessage(new ApiFailure(404, { code: 'not_found', message: 'No such channel.' }))
    assert.match(message, /channel/i)
    assert.match(message, /without a channel/i)
  })

  it('falls back to plain guidance when the failure is not an API error', () => {
    assert.match(createErrorMessage(new TypeError('network down')), /connection/i)
  })
})

describe('next action', () => {
  it('asks for a script before anything else, and does not call it urgent', () => {
    const action = nextAction(project())
    assert.equal(action.label, 'Generate the script')
    assert.equal(action.urgent, false)
  })

  it('puts a block ahead of the individual fixes', () => {
    // Matches the server's precedence: it reports duplication before it reports
    // missing commentary, so the dashboard must not point somewhere else.
    const action = nextAction(project({
      script: { wordCount: 180, hookEditedAt: null, commentaryAddedAt: null },
      originalityCheck: { verdict: 'BLOCKED', score: 0.3 },
    }))
    assert.match(action.label, /Blocked/)
    assert.equal(action.urgent, true)
  })

  it('asks for the hook, then the commentary, then the check', () => {
    const noHook = nextAction(project({ script: { wordCount: 180, hookEditedAt: null, commentaryAddedAt: null } }))
    assert.match(noHook.label, /hook/i)

    const noCommentary = nextAction(project({
      script: { wordCount: 180, hookEditedAt: 'now', commentaryAddedAt: null },
    }))
    assert.match(noCommentary.label, /commentary/i)

    const unchecked = nextAction(project({
      script: { wordCount: 180, hookEditedAt: 'now', commentaryAddedAt: 'now' },
    }))
    assert.match(unchecked.label, /guard/i)
  })

  it('reports ready only once the guard has actually passed', () => {
    const action = nextAction(project({
      script: { wordCount: 180, hookEditedAt: 'now', commentaryAddedAt: 'now' },
      originalityCheck: { verdict: 'PASS', score: 0.94 },
    }))
    assert.equal(action.label, 'Ready to publish')
    assert.equal(action.urgent, false)
  })
})
