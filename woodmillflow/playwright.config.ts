import { defineConfig } from '@playwright/test';

const PORT = 3200;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    trace: 'retain-on-failure'
  },
  webServer: {
    // Production build with its own throw-away embedded database.
    command: `rm -rf .data/e2e && npx next build && WOODMILLFLOW_DATA_DIR=.data/e2e npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false
  }
});
