// @ts-check
/**
 * Home / directory view — the public landing page that the Android app also loads.
 * Covers: hero, search bar, category chips, business cards (live demo seed),
 * navigation into a detail page, county filter, list/map toggle, and the
 * SQ<->EN language toggle.
 */
import { test, expect } from '@playwright/test';
import { goto, waitForResults, setLanguage } from './helpers.js';

test.describe('Home / directory', () => {
  test('renders the hero, search bar and register CTA', async ({ page }) => {
    await goto(page, '/');

    // Hero headline (Albanian default).
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('.hero h1')).toContainText(/biznese|business/i);

    // Search controls.
    await expect(page.locator('#q')).toBeVisible();
    await expect(page.locator('.searchbar select#county')).toBeVisible();
    await expect(page.locator('.searchbar button[type=submit]')).toBeVisible();

    // Header register CTA points at /regjistro.
    await expect(page.locator('header a.cta-header')).toHaveAttribute('href', '/regjistro');
  });

  test('loads businesses from the API into result cards', async ({ page }) => {
    await goto(page, '/');
    await waitForResults(page);

    // The demo seed publishes several businesses; expect at least one card.
    const cards = page.locator('#results .card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);

    // The results counter shows a number + the localized "businesses" word.
    await expect(page.locator('#count')).toContainText(/\d+/);

    // Each card links to a /biznes/<slug> profile.
    await expect(cards.first()).toHaveAttribute('href', /^\/biznes\/[a-z0-9-]+$/);
  });

  test('renders category filter chips', async ({ page }) => {
    await goto(page, '/');
    const chips = page.locator('#chips .chip');
    await expect(chips.first()).toBeVisible({ timeout: 15_000 });
    // "All categories" + the seeded categories.
    expect(await chips.count()).toBeGreaterThan(1);
  });

  test('navigates into a business detail page from a card', async ({ page }) => {
    await goto(page, '/');
    await waitForResults(page);

    const firstCard = page.locator('#results .card').first();
    await expect(firstCard).toBeVisible();
    const href = await firstCard.getAttribute('href');
    await firstCard.click();

    // SPA pushState navigation -> URL becomes the profile, detail head renders.
    await expect(page).toHaveURL(new RegExp(href.replace(/[/]/g, '\\/') + '$'));
    await expect(page.locator('.detail-title')).toBeVisible();
    // Back-to-directory breadcrumb is present.
    await expect(page.locator('.breadcrumb a')).toBeVisible();
  });

  test('filters by county via the search bar', async ({ page }) => {
    await goto(page, '/');
    await waitForResults(page);

    const county = page.locator('.searchbar select#county');
    // Wait for counties to populate (more than just the "all" option).
    await expect.poll(async () => county.locator('option').count()).toBeGreaterThan(1);

    // Pick the first real county and submit.
    const optionValue = await county.locator('option').nth(1).getAttribute('value');
    await county.selectOption(optionValue);
    await page.locator('.searchbar button[type=submit]').click();

    // URL reflects the filter (shareable), and results re-render.
    await expect(page).toHaveURL(new RegExp('county=' + optionValue));
    await waitForResults(page);
  });

  test('toggles between list and map views', async ({ page }) => {
    await goto(page, '/');
    await waitForResults(page);

    await page.locator('.viewtoggle button[data-view=map]').click();
    await expect(page.locator('#map')).toBeVisible({ timeout: 15_000 });

    await page.locator('.viewtoggle button[data-view=list]').click();
    await expect(page.locator('#results .grid, #results .state')).toBeVisible();
  });

  test('searching for an unlikely term shows the empty state', async ({ page }) => {
    await goto(page, '/');
    await waitForResults(page);

    await page.locator('#q').fill('zzzxqv-no-such-business-9999');
    await page.locator('.searchbar button[type=submit]').click();

    await expect(page.locator('#results .state')).toBeVisible({ timeout: 15_000 });
  });

  test('language toggle switches the register CTA to English', async ({ page }) => {
    await goto(page, '/');

    const cta = page.locator('header a.cta-header');
    await expect(cta).toHaveText(/Regjistro/i); // Albanian default

    await page.locator('.lang-toggle button[data-lang=en]').click();
    await expect(cta).toHaveText(/Register/i);   // English after toggle

    // Choice persists across reload.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('header a.cta-header')).toHaveText(/Register/i);
  });

  test('respects a pre-set English language preference', async ({ page }) => {
    await setLanguage(page, 'en');
    await goto(page, '/');
    await expect(page.locator('.hero h1')).toContainText(/Find Albanian businesses/i);
  });
});
