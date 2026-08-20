/**
 * One real script generation against the configured provider.
 *
 * Prints the script, the latency and the cost so a human can judge whether the
 * output is worth publishing — which is the only question the test suite cannot
 * answer.
 *
 *   npx tsx scripts/try-script.ts "your topic here" [durationSec]
 */
import { randomUUID } from 'node:crypto'
import { Plan, SubscriptionStatus, UserStatus } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { llmProvider } from '../src/modules/generation/providers/anthropic'
import { generateScript, getScript } from '../src/modules/generation/script.service'

// Claude Opus 5 list price, USD per million tokens.
const INPUT_PER_MTOK = 5
const OUTPUT_PER_MTOK = 25

const topic = process.argv[2] ?? 'why your video edits take twice as long as they should'
const durationSec = Number(process.argv[3] ?? 60)

async function main() {
  const provider = llmProvider()
  if (!provider) throw new Error('ANTHROPIC_API_KEY is not set — nothing to test.')

  const email = `tryout-${randomUUID().slice(0, 8)}@example.test`
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
  const project = await prisma.project.create({
    data: { userId: user.id, topic, targetDurationSec: durationSec, language: 'en' },
  })

  console.log(`\nTopic:    ${topic}`)
  console.log(`Target:   ${durationSec}s`)
  console.log(`Model:    claude-opus-5 (effort: high, adaptive thinking)\n`)
  console.log('Generating — this is a real API call, expect tens of seconds...\n')

  const startedAt = Date.now()
  try {
    const result = await generateScript(project.id, provider)
    const wallMs = Date.now() - startedAt

    console.log('='.repeat(78))
    console.log(`TITLE: ${result.title}`)
    console.log('='.repeat(78))
    console.log(`\nART DIRECTION\n${result.artDirection}\n`)
    console.log('-'.repeat(78))

    for (const scene of result.scenes) {
      const secs = ((scene.endMs - scene.startMs) / 1000).toFixed(1)
      console.log(`\n[${scene.ordinal}] ${scene.role}  (${secs}s)`)
      console.log(`  SAYS:   ${scene.narration}`)
      console.log(`  SHOWS:  ${scene.prompt}`)
    }

    console.log(`\n${'='.repeat(78)}`)
    console.log(`Words:            ${result.wordCount}`)
    console.log(`Estimated length: ${result.estimatedDurationSec}s (target ${durationSec}s)`)
    console.log(`Wall clock:       ${(wallMs / 1000).toFixed(1)}s`)

    // Re-read to confirm what actually landed in the database.
    const saved = await getScript(project.id)
    console.log(`\nPersisted: ${saved?.scenes.length} scenes, hook ${saved?.hook ? 'set' : 'MISSING'}, ` +
      `beats ${Array.isArray(saved?.beats) ? (saved.beats as unknown[]).length : 0}, ` +
      `hookEditedAt ${saved?.hookEditedAt ? 'set (WRONG — should be null)' : 'null (correct)'}`)
  } finally {
    await prisma.project.deleteMany({ where: { userId: user.id } })
    await prisma.subscription.deleteMany({ where: { userId: user.id } })
    await prisma.user.deleteMany({ where: { id: user.id } })
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('\nFAILED:', err?.message ?? err)
  if (err?.status) console.error('status:', err.status)
  process.exit(1)
})
