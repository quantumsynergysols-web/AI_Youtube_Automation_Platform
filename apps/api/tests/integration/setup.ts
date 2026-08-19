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
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_ACCESS_SECRET ??= 'integration-access-secret-at-least-32-characters'
process.env.JWT_REFRESH_SECRET ??= 'integration-refresh-secret-at-least-32-characters'
process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_integration_test_secret'
process.env.STRIPE_PRICE_CREATOR ??= 'price_creator_integration'
