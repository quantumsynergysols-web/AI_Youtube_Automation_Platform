/**
 * End-to-end check for the projects module and the FR-4 script endpoints,
 * against a running API and a real database.
 *
 * Deliberately exercises HTTP rather than calling the service directly: the
 * things most likely to be wrong — route mounting order, auth, zod coercion of
 * query strings, status codes — are all invisible to a service-level test.
 *
 *   npx tsx scripts/verify-projects.ts
 */
import { randomUUID } from 'node:crypto'
import { Plan, SubscriptionStatus, UserStatus } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { signAccessToken } from '../src/middleware/auth'
import { env } from '../src/config/env'

const BASE = process.env.API_URL ?? `http://localhost:${env.API_PORT}`

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  return { status: res.status, json: text ? JSON.parse(text) : null }
}

async function makeUser(label: string) {
  const email = `verify-${label}-${randomUUID().slice(0, 8)}@example.test`
  const user = await prisma.user.create({
    data: { email, passwordHash: 'not-a-real-hash', status: UserStatus.ACTIVE },
  })
  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: Plan.FREE,
      status: SubscriptionStatus.ACTIVE,
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  return {
    id: user.id,
    email,
    token: signAccessToken({ sub: user.id, email, isAdmin: false }),
  }
}

async function main() {
  console.log(`\nVerifying projects + script endpoints against ${BASE}\n`)

  const alice = await makeUser('alice')
  const mallory = await makeUser('mallory')
  const createdProjectIds: string[] = []

  try {
    // ---- create ----
    const created = await api(alice.token, 'POST', '/api/projects', {
      topic: 'why your edit feels slow even when you are fast',
      targetDurationSec: 60,
    })
    check('POST /api/projects returns 201', created.status === 201, `got ${created.status}`)
    check('project starts in DRAFT', created.json?.state === 'DRAFT', created.json?.state)
    const projectId = created.json?.id
    if (projectId) createdProjectIds.push(projectId)

    // ---- plan limit ----
    const tooLong = await api(alice.token, 'POST', '/api/projects', {
      topic: 'a feature length film',
      targetDurationSec: 600,
    })
    check('over-cap duration is refused with 403', tooLong.status === 403, `got ${tooLong.status}`)
    check(
      'refusal does not promise an upgrade that would not help',
      typeof tooLong.json?.error?.message === 'string' && !/upgrade/i.test(tooLong.json.error.message),
      JSON.stringify(tooLong.json),
    )

    // ---- validation ----
    const blank = await api(alice.token, 'POST', '/api/projects', { topic: '   ' })
    check('blank topic is refused', blank.status === 400, `got ${blank.status}`)

    // ---- list ----
    const listed = await api(alice.token, 'GET', '/api/projects?limit=10')
    check('GET /api/projects returns a page', Array.isArray(listed.json?.projects), listed.status.toString())
    check(
      'the new project is in the list',
      listed.json?.projects?.some((p: any) => p.id === projectId),
    )

    // ---- read ----
    const fetched = await api(alice.token, 'GET', `/api/projects/${projectId}`)
    check('GET /api/projects/:id returns the project', fetched.json?.id === projectId, `got ${fetched.status}`)

    // ---- tenant isolation ----
    const stolen = await api(mallory.token, 'GET', `/api/projects/${projectId}`)
    check(
      "another user gets 404, not 403, for someone else's project",
      stolen.status === 404,
      `got ${stolen.status}`,
    )
    const stolenPatch = await api(mallory.token, 'PATCH', `/api/projects/${projectId}`, { topic: 'hijacked' })
    check('another user cannot edit it', stolenPatch.status === 404, `got ${stolenPatch.status}`)
    const stolenDelete = await api(mallory.token, 'DELETE', `/api/projects/${projectId}`)
    check('another user cannot delete it', stolenDelete.status === 404, `got ${stolenDelete.status}`)

    // ---- auth ----
    const anon = await fetch(`${BASE}/api/projects`)
    check('unauthenticated list is rejected', anon.status === 401, `got ${anon.status}`)

    // ---- update ----
    const patched = await api(alice.token, 'PATCH', `/api/projects/${projectId}`, {
      topic: 'the real reason your edit feels slow',
    })
    check(
      'PATCH updates the topic',
      patched.json?.topic === 'the real reason your edit feels slow',
      `got ${patched.status}`,
    )

    // ---- route mounting: the sub-resource routes must not be shadowed ----
    const script = await api(alice.token, 'GET', `/api/projects/${projectId}/script`)
    check(
      'GET /:id/script is reachable and reports no script yet',
      script.status === 200 && script.json?.generated === false,
      `got ${script.status} ${JSON.stringify(script.json)}`,
    )

    const guard = await api(alice.token, 'GET', `/api/projects/${projectId}/originality-check`)
    check(
      'GET /:id/originality-check is still reachable after adding the projects router',
      guard.status === 200 && guard.json?.checked === false,
      `got ${guard.status}`,
    )

    // ---- provider gating ----
    const generate = await api(alice.token, 'POST', `/api/projects/${projectId}/script`)
    if (env.ANTHROPIC_API_KEY) {
      check('script generation succeeds with a key configured', generate.status === 200, `got ${generate.status}`)
    } else {
      check(
        'script generation reports 501 when no provider key is set',
        generate.status === 501 && generate.json?.error?.code === 'provider_not_configured',
        `got ${generate.status} ${JSON.stringify(generate.json)}`,
      )
    }

    // ---- delete ----
    const deleted = await api(alice.token, 'DELETE', `/api/projects/${projectId}`)
    check('DELETE returns 204', deleted.status === 204, `got ${deleted.status}`)
    const gone = await api(alice.token, 'GET', `/api/projects/${projectId}`)
    check('deleted project is gone', gone.status === 404, `got ${gone.status}`)
    if (gone.status === 404) createdProjectIds.pop()
  } finally {
    // Leave the database as it was found.
    for (const id of createdProjectIds) {
      await prisma.project.deleteMany({ where: { id } }).catch(() => undefined)
    }
    await prisma.project.deleteMany({ where: { userId: { in: [alice.id, mallory.id] } } })
    await prisma.subscription.deleteMany({ where: { userId: { in: [alice.id, mallory.id] } } })
    await prisma.user.deleteMany({ where: { id: { in: [alice.id, mallory.id] } } })
    await prisma.$disconnect()
  }

  console.log(`\n  ${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
