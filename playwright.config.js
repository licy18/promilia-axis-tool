import { defineConfig, devices } from '@playwright/test';

const e2ePort = Number(process.env.PROMILIA_E2E_PORT ?? 5182);
const e2eHost = process.env.PROMILIA_E2E_HOST ?? '127.0.0.1';
const e2eBaseUrl = `http://${e2eHost}:${e2ePort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: [['list']],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: e2eBaseUrl,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host ${e2eHost} --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
