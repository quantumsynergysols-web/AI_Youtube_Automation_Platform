/**
 * Seeds one activated account with a generated script, so the review screen can
 * be looked at with real content in it.
 *
 *   npx tsx scripts/demo-seed.ts
 */
import argon2 from 'argon2'
import { Plan, SubscriptionStatus, UserStatus } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { llmProvider } from '../src/modules/generation/providers/anthropic'
import { generateScript } from '../src/modules/generation/script.service'

const EMAIL = 'demo@viralpilot.io'
const PASSWORD = 'DemoPilot!2026'
const TOPIC = 'why your video edits take twice as long as they should'

async function main() {
  await prisma.user.deleteMany({ where: { email: EMAIL } })

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await argon2.hash(PASSWORD),
      status: UserStatus.ACTIVE,
    },
  })
  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: Plan.CREATOR,
      status: SubscriptionStatus.ACTIVE,
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const project = await prisma.project.create({
    data: { userId: user.id, topic: TOPIC, targetDurationSec: 60, language: 'en' },
  })

  const provider = llmProvider()
  if (!provider) throw new Error('ANTHROPIC_API_KEY is not set.')

  console.log('Generating a script for the demo account...')
  const result = await generateScript(project.id, provider)

  console.log('\n  email:      ' + EMAIL)
  console.log('  password:   ' + PASSWORD)
  console.log('  project:    ' + project.id)
  console.log('  scenes:     ' + result.scenes.length)
  console.log('\n  review at:  http://localhost:5273/projects/' + project.id + '/script\n')

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
