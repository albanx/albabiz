// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * AlbaBiz.ie — Playwright config.
 *
 * Tests run against a DEPLOYED site by default (the live Pages URL), because the
 * front-end's API base is baked into /config.js and points at the live Worker.
 * Override the target with BASE_URL, e.g. to test a preview deploy:
 *   BASE_URL=https://<hash>.albabiz.pages.dev npm test
 *
 * To exercise the authenticated admin flow, also pass the break-glass token:
 *   ADMIN_TOKEN=<value> npm run test:admin
 * Without it, the admin spec only verifies the sign-in gate (no secret needed).
 */
const BASE_URL = process.env.BASE_URL || 'https://albabiz.pages.dev';

export default defineConfig({
  testDir: './e2e',
  // The directory tree is small; keep output here and gitignored.
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // The live API can be a little slow on cold start; be patient on actions.
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to broaden coverage once chromium is green:
    // { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
    // { name: 'mobile',   use: { ...devices['Pixel 7'] } },
  ],
});
