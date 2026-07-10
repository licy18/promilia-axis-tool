import { defineConfig, devices } from '@playwright/test';

const previewPort = Number(process.env.PROMILIA_PREVIEW_E2E_PORT ?? 5183);
const previewHost = process.env.PROMILIA_PREVIEW_E2E_HOST ?? '127.0.0.1';
const previewBaseUrl = `http://${previewHost}:${previewPort}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'workbench-production-preview.spec.js',
  fullyParallel: false,
  reporter: [
    ['list'],
    [
      './scripts/production-preview-reporter.mjs',
      { outputFile: 'reports/production-preview-acceptance.json' },
    ],
  ],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: previewBaseUrl,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run preview -- --host ${previewHost} --port ${previewPort} --strictPort`,
    url: previewBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
