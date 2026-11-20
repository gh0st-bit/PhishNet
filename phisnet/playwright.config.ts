import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.E2E_BASE_URL || 'http://localhost:5000', trace: 'retain-on-failure', ...devices['Desktop Chrome'], // Windows machines always have Edge, so the suite runs without `npx playwright install`.
    channel: process.env.E2E_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) },
});
