import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // The database tests share one test database: run files one after another.
    fileParallelism: false
  }
})
