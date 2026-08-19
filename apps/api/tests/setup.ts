// Values only need to satisfy the schema in src/config/env.ts; nothing here
// reaches a real service.
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'silent'
process.env.DATABASE_URL ??= 'postgresql://ytap:ytap@localhost:5432/ytap_test?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters'
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters'
process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_dummy'
process.env.STRIPE_PRICE_CREATOR ??= 'price_creator_test'
process.env.STRIPE_PRICE_PRO ??= 'price_pro_test'
// 32 random bytes, base64. Test-only value; production generates its own.
process.env.TOKEN_ENCRYPTION_KEY ??= 'uM+tLOBxgrEuyYkJZ4VoqNBkiVY6jN/i6jnnXNRdlI0='
process.env.GOOGLE_CLIENT_SECRET ??= 'test-google-client-secret'
process.env.GOOGLE_REDIRECT_URI ??= 'http://localhost:4300/api/channels/callback'
