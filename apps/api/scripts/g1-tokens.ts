// Use the shared client rather than a bare PrismaClient: it loads the repo-root
// .env, so this runs without exporting DATABASE_URL by hand.
import { prisma } from '../src/lib/prisma'
import { decryptSecret } from '../src/lib/crypto'

async function main() {
  const c = await prisma.channel.findFirst({ orderBy: { connectedAt: 'desc' } })
  if (!c?.oauthTokenEnc || !c.refreshTokenEnc) {
    console.log('NO TOKENS STORED')
    return
  }

  const a = Buffer.from(c.oauthTokenEnc)
  const r = Buffer.from(c.refreshTokenEnc)
  const ap = decryptSecret(a)
  const rp = decryptSecret(r)

  console.log('channel            :', c.title, '(' + c.youtubeChannelId + ')')
  console.log('access  ciphertext :', a.length, 'bytes')
  console.log('refresh ciphertext :', r.length, 'bytes')
  console.log('plaintext leaked?  :', a.toString('utf8').includes(ap) || r.toString('utf8').includes(rp))
  console.log('access  decrypts   : length', ap.length, 'prefix', JSON.stringify(ap.slice(0, 6)))
  console.log('refresh decrypts   : length', rp.length, 'prefix', JSON.stringify(rp.slice(0, 4)))
  console.log('scopes stored      :', c.grantedScopes.length, c.grantedScopes.map((s) => s.split('/').pop()).join(', '))
  console.log('tokenExpiresAt     :', c.tokenExpiresAt?.toISOString())
  console.log('baselineAt         :', c.baselineAt?.toISOString())
  console.log('iv (hex)           :', a.subarray(0, 12).toString('hex'))
  console.log('auth tag (hex)     :', a.subarray(12, 28).toString('hex'))
}

main()
  .catch((e) => {
    console.error('failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
