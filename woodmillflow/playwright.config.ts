import { defineConfig } from '@playwright/test';

const PORT = 3200;
// Set E2E_DATABASE_URL to run the same tests against a real PostgreSQL server instead of the
// embedded database (the server is then reset through the demo reset API with E2E_RESET_PIN).
const pg = process.env.E2E_DATABASE_URL;
const serverEnv = pg ? `DATABASE_URL=${pg} DEMO_RESET_PIN=${process.env.E2E_RESET_PIN ?? 'e2e-pin'}` : 'WOODMILLFLOW_DATA_DIR=.data/e2e';

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
    command: `rm -rf .data/e2e && npx next build && ${serverEnv} npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: false
  }
});
