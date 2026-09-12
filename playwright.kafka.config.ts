import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/kafka',
  timeout: 35_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report-kafka',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL:
      process.env.KAFKA_API_BASE_URL ??
      process.env.API_BASE_URL ??
      'http://127.0.0.1:18080',
    trace: 'retain-on-failure',
  },
});
