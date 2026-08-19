#!/usr/bin/env node
/**
 * Gate G0 — "a user signs up, subscribes through Stripe in test mode, and a dummy
 * job runs end to end through the queue."
 *
 * This script covers everything except the Stripe card entry, which needs a browser.
 * Run it with the API, worker, PostgreSQL and Redis all up. Exits non-zero on the
 * first failed check so it can gate a deploy.
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

// Read DATABASE_URL from the repo-root .env so the prisma subprocess below
// does not depend on it being exported in the caller's shell.
function rootEnv(key) {
  try {
    const text = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`))
    return line ? line.slice(key.length + 1).replace(/^"|"$/g, '') : undefined
  } catch {
    return undefined
  }
}

const API = process.env.API_URL ?? 'http://localhost:4300'
const email = `g0-${randomBytes(5).toString('hex')}@example.test`
const password = 'phase-zero-probe-password'

let passed = 0
let failed = 0

function ok(label, detail = '') {
  passed++
  console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ''}`)
}

function fail(label, detail) {
  failed++
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}`)
  if (detail) console.log(`        ${detail}`)
  console.log('\nG0 not met.')
  process.exit(1)
}

async function call(path, init = {}, token = null) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  const body = res.status === 204 ? {} : await res.json().catch(() => ({}))
  return { status: res.status, body }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

console.log(`\nGate G0 — ${API}\n`)

// 1. service is up ----------------------------------------------------------
{
  const { status, body } = await call('/health/ready')
  if (status !== 200) fail('services reachable', JSON.stringify(body))
  ok('services reachable', `db=${body.checks.database} redis=${body.checks.redis}`)
}

// 2. registration -----------------------------------------------------------
{
  const { status, body } = await call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (status !== 201) fail('register a new account', JSON.stringify(body))
  ok('register a new account', email)
}

// 3. unverified accounts are blocked ----------------------------------------
{
  const { body } = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const probe = await call('/api/billing/allowance', {}, body.accessToken)
  if (probe.status !== 403) fail('unverified account is blocked', `expected 403, got ${probe.status}`)
  ok('unverified account is blocked')
}

// 4. verify email -----------------------------------------------------------
// The token only exists in the email; read the hash row straight from the
// database and mark the user active, which is what clicking the link does.
{
  try {
    execFileSync(
      'npx',
      ['prisma', 'db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'],
      {
        cwd: new URL('../apps/api/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
        input: `UPDATE "User" SET "status" = 'ACTIVE' WHERE "email" = '${email}';`,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? rootEnv('DATABASE_URL') },
      },
    )
    ok('email verified')
  } catch (err) {
    fail('email verified', String(err.stderr ?? err))
  }
}

// 5. sign in ----------------------------------------------------------------
let accessToken
let refreshToken
{
  const { status, body } = await call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (status !== 200 || !body.accessToken) fail('sign in', JSON.stringify(body))
  accessToken = body.accessToken
  refreshToken = body.refreshToken
  ok('sign in')
}

// 6. refresh rotation -------------------------------------------------------
{
  const first = await call('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
  if (first.status !== 200) fail('refresh token rotates', JSON.stringify(first.body))

  const replay = await call('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
  if (replay.status !== 401) fail('replayed refresh token is rejected', `got ${replay.status}`)

  accessToken = first.body.accessToken
  ok('refresh token rotates and replay is rejected')
}

// 7. plan catalogue and allowance -------------------------------------------
{
  const plans = await call('/api/billing/plans')
  if (plans.status !== 200 || plans.body.plans.length !== 5) fail('plan catalogue', JSON.stringify(plans.body))
  ok('plan catalogue', `${plans.body.plans.length} plans`)

  const allowance = await call('/api/billing/allowance', {}, accessToken)
  if (allowance.status !== 200) fail('allowance readable', JSON.stringify(allowance.body))
  ok('allowance readable', `${allowance.body.plan}: ${allowance.body.videosRemaining} remaining`)
}

// 8. the queue round trip ---------------------------------------------------
let jobId
{
  const { status, body } = await call(
    '/api/jobs/dummy',
    { method: 'POST', body: JSON.stringify({ message: 'gate G0', delayMs: 300 }) },
    accessToken,
  )
  if (status !== 202 || !body.jobId) fail('enqueue probe job', JSON.stringify(body))
  jobId = body.jobId
  ok('enqueue probe job', jobId)
}

{
  let final = null
  for (let i = 0; i < 40; i++) {
    await sleep(500)
    const { body } = await call(`/api/jobs/${jobId}`, {}, accessToken)
    if (body.status === 'SUCCEEDED' || body.status === 'DEAD' || body.status === 'FAILED') {
      final = body
      break
    }
  }
  if (!final) fail('worker processes the job', 'timed out after 20s — is the worker running?')
  if (final.status !== 'SUCCEEDED') fail('worker processes the job', JSON.stringify(final))
  ok('worker processes the job', `echo="${final.result?.echo}"`)
}

// 9. allowance is consumed and enforced --------------------------------------
{
  const before = await call('/api/billing/allowance', {}, accessToken)
  const run = await call('/api/jobs/dummy?consume=1', { method: 'POST', body: '{}' }, accessToken)
  if (run.status !== 202) fail('allowance-consuming job accepted', JSON.stringify(run.body))
  const after = await call('/api/billing/allowance', {}, accessToken)

  if (after.body.videosUsed !== before.body.videosUsed + 1) {
    fail('allowance decrements', `${before.body.videosUsed} -> ${after.body.videosUsed}`)
  }
  ok('allowance decrements', `${before.body.videosUsed} -> ${after.body.videosUsed}`)
}

{
  // Free plan includes 3 videos; drain the rest and confirm the next call is refused.
  let refused = null
  for (let i = 0; i < 6; i++) {
    const res = await call('/api/jobs/dummy?consume=1', { method: 'POST', body: '{}' }, accessToken)
    if (res.status === 402) {
      refused = res
      break
    }
  }
  if (!refused) fail('allowance is enforced', 'never received a 402 after exhausting the free plan')
  if (refused.body.error?.code !== 'allowance_exhausted') {
    fail('allowance is enforced', JSON.stringify(refused.body))
  }
  ok('allowance is enforced', '402 allowance_exhausted')
}

console.log(`\n\x1b[32m${passed} checks passed\x1b[0m, ${failed} failed`)
console.log('\nG0 automated portion met.')
console.log('Remaining manual step: subscribe with Stripe test card 4242 4242 4242 4242')
console.log('and confirm the dashboard reports plan CREATOR with 30 videos.\n')
