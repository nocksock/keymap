import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', 'test/*.browser-test.ts', 'demo/**'],
  }
})
