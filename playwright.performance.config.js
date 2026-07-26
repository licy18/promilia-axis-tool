import { defineConfig, devices } from '@playwright/test';

const previewPort = Number(process.env.PROMILIA_PERF_PREVIEW_PORT ?? 5184);
const previewHost = process.env.PROMILIA_PERF_PREVIEW_HOST ?? '127.0.0.1';
const externalBaseUrl = process.env.PROMILIA_PERF_BASE_URL ?? '';
const previewBaseUrl =
  externalBaseUrl || `http://${previewHost}:${previewPort}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'workbench-performance.spec.js',
  fullyParallel: false,
  reporter: 'list',
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: previewBaseUrl,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npm run preview -- --host ${previewHost} --port ${previewPort} --strictPort`,
        url: previewBaseUrl,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
