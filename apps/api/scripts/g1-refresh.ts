/**
 * Gate G1, final leg: "tokens survive a refresh cycle."
 *
 * Expires the stored access token, asks for one, and checks that a genuinely
 * new token came back AND that the stored ciphertext was replaced. Checking the
 * returned value alone would pass even if nothing were persisted.
 */
import { prisma } from '../src/lib/prisma'
import { decryptSecret } from '../src/lib/crypto'
import { accessTokenFor } from '../src/modules/channels/channels.service'

async function main() {
  const before = await prisma.channel.findFirst({ orderBy: { connectedAt: 'desc' } })
  if (!before?.oauthTokenEnc || !before.refreshTokenEnc) {
    console.log('no channel with tokens')
    return
  }

  const oldCipher = Buffer.from(before.oauthTokenEnc)
  const oldToken = decryptSecret(oldCipher)
  const oldRefresh = decryptSecret(Buffer.from(before.refreshTokenEnc))

  console.log('before  access token :', oldToken.slice(0, 12) + '…', `(${oldToken.length} chars)`)
  console.log('before  expires at   :', before.tokenExpiresAt?.toISOString())
  console.log('before  lastRefresh  :', before.lastRefreshedAt?.toISOString() ?? 'never')

  // Force the refresh path.
  await prisma.channel.update({
    where: { id: before.id },
    data: { tokenExpiresAt: new Date(Date.now() - 60_000) },
  })
  console.log('\nexpired the stored token, requesting a fresh one from Google…\n')

  const fresh = await accessTokenFor(before.id)
  const after = await prisma.channel.findUniqueOrThrow({ where: { id: before.id } })
  const newCipher = Buffer.from(after.oauthTokenEnc!)
  const newRefresh = decryptSecret(Buffer.from(after.refreshTokenEnc!))

  console.log('after   access token :', fresh.slice(0, 12) + '…', `(${fresh.length} chars)`)
  console.log('after   expires at   :', after.tokenExpiresAt?.toISOString())
  console.log('after   lastRefresh  :', after.lastRefreshedAt?.toISOString() ?? 'never')

  const checks: [string, boolean][] = [
    ['returned a usable token', fresh.startsWith('ya29.') && fresh.length > 50],
    ['token actually changed', fresh !== oldToken],
    ['stored ciphertext replaced', !newCipher.equals(oldCipher)],
    ['expiry pushed into the future', !!after.tokenExpiresAt && after.tokenExpiresAt > new Date()],
    ['lastRefreshedAt recorded', !!after.lastRefreshedAt],
    ['refresh token preserved', newRefresh === oldRefresh],
  ]

  console.log()
  let ok = true
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${label}`)
    ok &&= pass
  }
  console.log(ok ? '\n\x1b[32mtokens survive a refresh cycle\x1b[0m\n' : '\n\x1b[31mrefresh cycle broken\x1b[0m\n')
  if (!ok) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error('failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
