import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      // Load .env from project root (one level up from backend/)
      DOTENV_CONFIG_PATH: '../.env',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
    },
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
