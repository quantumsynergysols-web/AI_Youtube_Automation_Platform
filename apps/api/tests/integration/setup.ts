import { randomBytes } from 'node:crypto'

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ??
  'postgresql://ytap:ytap@localhost:5432/ytap_test?schema=public'

let databaseName: string
try {
  databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')
} catch {
  throw new Error('Integration tests require a valid PostgreSQL TEST_DATABASE_URL or DATABASE_URL.')
}
if (!/(^|_)test($|_)/i.test(databaseName)) {
  throw new Error(`Refusing to run integration tests against non-test database "${databaseName}".`)
}

process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'
process.env.DATABASE_URL = databaseUrl
// Redis has no equivalent of the database-name guard above, and this suite calls
// flushdb() between tests. Locally that is the same Redis the dev worker uses, so
// default to a dedicated index and refuse index 0 outright.
const redisUrl =
  process.env.TEST_REDIS_URL ?? process.env.REDIS_URL ?? 'redis://localhost:6379/15'

let redisIndex: string
try {
  redisIndex = new URL(redisUrl).pathname.replace(/^\//, '')
} catch {
  throw new Error('Integration tests require a valid REDIS_URL or TEST_REDIS_URL.')
}
if (!redisIndex || redisIndex === '0') {
  throw new Error(
    `Refusing to run integration tests against Redis database ${redisIndex || '0'}: ` +
      'flushdb() would wipe the development queue. Use an explicit non-zero index, ' +
      'for example redis://localhost:6379/15.',
  )
}

process.env.REDIS_URL = redisUrl
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-at-least-32-characters'
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-at-least-32-characters'
process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_integration_test_secret'
process.env.STRIPE_PRICE_CREATOR ??= 'price_creator_integration'
process.env.GOOGLE_CLIENT_ID ??= 'integration-google-client'
process.env.GOOGLE_CLIENT_SECRET ??= randomBytes(24).toString('hex')
process.env.GOOGLE_REDIRECT_URI ??= 'http://localhost:4300/api/channels/callback'
process.env.TOKEN_ENCRYPTION_KEY ??= randomBytes(32).toString('base64')
