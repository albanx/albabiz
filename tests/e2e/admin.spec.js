// @ts-check
/**
 * Admin panel (/admin/) — the web management UI.
 *
 * Auth model (see cloud/worker/src/access.js): on a *.workers.dev API with no
 * Cloudflare Access in front, the admin SPA boots, probes GET /api/admin/pending,
 * gets 401, and reveals the break-glass token gate. A wrong token keeps you
 * gated. The full authenticated flow only runs when you pass a real token:
 *   ADMIN_TOKEN=<value> npm run test:admin
 */
import { test, expect } from '@playwright/test';
import { gotoAdmin } from './helpers.js';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

test.describe('Admin panel', () => {
  test('shows the sign-in gate when not authenticated', async ({ page }) => {
    await gotoAdmin(page);

    // Gate is visible; the main app is hidden behind it.
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('#gate h2')).toContainText(/sign-in/i);
    await expect(page.locator('#app')).toBeHidden();
  });

  test('the gate exposes a password token field and submit button', async ({ page }) => {
    await gotoAdmin(page);
    await expect(page.locator('#gate #token')).toHaveAttribute('type', 'password');
    await expect(page.locator('#gate-form button[type=submit]')).toBeVisible();
  });

  test('a wrong token keeps the panel gated (no access)', async ({ page }) => {
    await gotoAdmin(page);

    await page.locator('#gate #token').fill('definitely-not-the-real-token');
    await page.locator('#gate-form button[type=submit]').click();

    // boot() re-probes with the bad token -> 401 -> showGate() again.
    await expect(page.locator('#gate')).toBeVisible();
    await expect(page.locator('#app')).toBeHidden();
  });

  test('admin pages carry a noindex robots tag', async ({ page }) => {
    await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/i);
  });

  // The authenticated flow needs a real break-glass token. Skipped unless
  // ADMIN_TOKEN is supplied, so the suite never hard-codes a secret.
  test.describe('authenticated (requires ADMIN_TOKEN)', () => {
    test.skip(!ADMIN_TOKEN, 'set ADMIN_TOKEN to run the signed-in admin flow');

    test('a valid token unlocks the dashboard and tabs', async ({ page }) => {
      await gotoAdmin(page);

      await page.locator('#gate #token').fill(ADMIN_TOKEN);
      await page.locator('#gate-form button[type=submit]').click();

      // Gate disappears, app + tabs render.
      await expect(page.locator('#app')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('#gate')).toBeHidden();
      await expect(page.locator('.tab-btn[data-tab=pending]')).toBeVisible();
      await expect(page.locator('#signout')).toBeVisible();
    });

    test('can open the Metrics tab', async ({ page }) => {
      await gotoAdmin(page);
      await page.locator('#gate #token').fill(ADMIN_TOKEN);
      await page.locator('#gate-form button[type=submit]').click();
      await expect(page.locator('#app')).toBeVisible({ timeout: 15_000 });

      await page.locator('.tab-btn[data-tab=metrics]').click();
      // The metrics dashboard renders a range picker + stat cards.
      await expect(page.locator('#metric-range')).toBeVisible({ timeout: 15_000 });
    });
  });
});
