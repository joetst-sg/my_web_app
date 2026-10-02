import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '.'), 'server-only': path.resolve(import.meta.dirname, 'tests/stubs/server-only.ts') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Integration tests share one database; run files one at a time.
    fileParallelism: false,
  },
})
