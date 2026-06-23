// @ts-check
/**
 * Shared helpers + stable selectors for the AlbaBiz.ie e2e suite.
 *
 * The site is a no-framework SPA: views are rendered into <main id="main"> by
 * app.js after the scripts boot, and several controls (county/category selects,
 * business cards) are filled from the live Worker API asynchronously. So we wait
 * on *rendered content* rather than navigation events.
 */
import { expect } from '@playwright/test';

/** localStorage key app uses to persist the chosen language. */
export const LANG_KEY = 'albabiz.lang';

/** Go to a route and wait for the SPA shell + scripts to be ready. */
export async function goto(page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  // app.js wires the language toggle on boot; once the header CTA has its
  // translated text the SPA has booted.
  await expect(page.locator('header .cta-header')).toBeVisible();
}

/** Force the UI language before navigating (so first render is in that lang). */
export async function setLanguage(page, lang) {
  await page.addInitScript(
    ([key, value]) => { try { window.localStorage.setItem(key, value); } catch (e) {} },
    [LANG_KEY, lang]
  );
}

/** Wait for the home directory to finish its first business load. */
export async function waitForResults(page) {
  const results = page.locator('#results');
  await expect(results).toBeVisible();
  // Either business cards rendered, or the branded empty-state pane.
  await expect(
    results.locator('.grid .card, .state, #map')
  ).toHaveCount(1, { timeout: 15_000 }).catch(() => {});
  // At least one card OR an empty state must be present.
  const cards = results.locator('.card');
  const state = results.locator('.state');
  await expect(cards.first().or(state.first())).toBeVisible({ timeout: 15_000 });
}

/** Open the registration form view and wait for it to render. */
export async function gotoRegister(page) {
  await goto(page, '/regjistro');
  await expect(page.locator('#submit-form')).toBeVisible();
}

/** Open the admin panel and wait for either the gate or the app to settle. */
export async function gotoAdmin(page) {
  await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
  // boot() probes the API; on 401 it reveals #gate, on success #app.
  await expect(page.locator('#gate, #app')).toHaveCount(2); // both exist in DOM
  await expect(
    page.locator('#gate:visible, #app:visible').first()
  ).toBeVisible({ timeout: 15_000 });
}
