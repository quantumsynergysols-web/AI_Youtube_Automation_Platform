import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Recursive, with the integration folder excluded explicitly. Narrowing this
    // to tests/*.test.ts would silently skip any future tests/unit/*.test.ts.
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    setupFiles: ['tests/setup.ts'],
    pool: 'forks',
  },
})
