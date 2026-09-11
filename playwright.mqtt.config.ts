import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/mqtt',
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-mqtt', open: 'never' }],
  ],
  use: {
    baseURL:
      process.env.MQTT_API_BASE_URL ??
      process.env.API_BASE_URL ??
      'http://127.0.0.1:18080',
    trace: 'retain-on-failure',
  },
});