import { defineConfig } from 'vitest/config';

// Tests run against a separate database (TEST_DATABASE_URL), migrated once in tests/global-setup.ts.
const testDb = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/online_training_test';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDb,
      JWT_SECRET: 'test-secret-0123456789abcdef',
      WEB_URL: 'http://localhost:5173',
      API_URL: 'http://localhost:4000',
      DEV_FAKE_PAYMENTS: 'true',
      STRIPE_SECRET_KEY: '',
      UPLOAD_DIR: 'uploads-test',
    },
  },
});
