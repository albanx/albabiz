// @ts-check
/**
 * Business registration form (/regjistro).
 *
 * app.js validates on the client BEFORE any network call: an empty name renders
 * `form.errName`, and an unticked consent box renders `form.errGdpr` — both into
 * #form-msg. That lets us assert the validation UX without submitting real data
 * or solving the Turnstile challenge.
 */
import { test, expect } from '@playwright/test';
import { gotoRegister, setLanguage } from './helpers.js';

test.describe('Business registration', () => {
  test('renders all four form sections and key fields', async ({ page }) => {
    await gotoRegister(page);

    // Section headings (4 sections: business, location, contact, media).
    await expect(page.locator('#submit-form .form-section')).toHaveCount(4);

    // Core fields exist.
    await expect(page.locator('#submit-form [name=name]')).toBeVisible();
    await expect(page.locator('#submit-form [name=owner_name]')).toBeVisible();
    await expect(page.locator('#submit-form #category')).toBeVisible();
    await expect(page.locator('#submit-form #county')).toBeVisible();
    await expect(page.locator('#submit-form [name=email]')).toBeVisible();
    await expect(page.locator('#submit-form [name=logo]')).toHaveAttribute('type', 'file');
  });

  test('logo input is camera-first on mobile with a gallery fallback', async ({ page }) => {
    await gotoRegister(page);

    const logo = page.locator('#submit-form #logo');
    // `capture=environment` makes mobile browsers open the rear camera first.
    await expect(logo).toHaveAttribute('capture', 'environment');
    await expect(logo).toHaveAttribute('accept', /image\//);

    // A visible "choose from gallery" fallback button exists next to it.
    const gallery = page.locator('#submit-form .form-section button', { hasText: /gallery|galeri/i });
    await expect(gallery).toBeVisible();
  });

  test('category is a single-select dropdown populated from the API', async ({ page }) => {
    await gotoRegister(page);

    const category = page.locator('#submit-form select#category');
    await expect(category).toBeVisible();
    // It's a <select> (single-select), NOT a checkbox group.
    expect(await category.evaluate((el) => el.tagName)).toBe('SELECT');

    // Placeholder option + categories load asynchronously from /api/categories.
    await expect.poll(async () => category.locator('option').count()).toBeGreaterThan(1);
    // First option is the "select category" placeholder with an empty value.
    await expect(category.locator('option').first()).toHaveAttribute('value', '');
  });

  test('county dropdown is populated from the API', async ({ page }) => {
    await gotoRegister(page);
    const county = page.locator('#submit-form select#county');
    await expect.poll(async () => county.locator('option').count()).toBeGreaterThan(1);
  });

  test('has an anti-spam honeypot and a Turnstile container', async ({ page }) => {
    await gotoRegister(page);
    // Honeypot is visually hidden but in the DOM.
    await expect(page.locator('#submit-form input[name=company_fax]')).toHaveCount(1);
    // Turnstile widget mount point with the public site key.
    const ts = page.locator('#submit-form .cf-turnstile');
    await expect(ts).toHaveCount(1);
    await expect(ts).toHaveAttribute('data-sitekey', /.+/);
  });

  test('blocks submit with an empty name (client-side validation)', async ({ page }) => {
    await gotoRegister(page);

    // Submit immediately — name is empty.
    await page.locator('#submit-form button[type=submit]').click();

    const msg = page.locator('#form-msg .alert-err');
    await expect(msg).toBeVisible();
    // Albanian default copy: "Emri i biznesit është i detyrueshëm."
    await expect(msg).toContainText(/detyrueshëm|required/i);

    // Still on the form (no navigation to the success state).
    await expect(page.locator('#submit-form')).toBeVisible();
  });

  test('blocks submit when GDPR consent is unticked', async ({ page }) => {
    await gotoRegister(page);

    await page.locator('#submit-form [name=name]').fill('Test Biznes Playwright');
    // Leave the consent checkbox unticked, then submit.
    await page.locator('#submit-form button[type=submit]').click();

    const msg = page.locator('#form-msg .alert-err');
    await expect(msg).toBeVisible();
    // "Duhet të japësh pëlqimin..." / "You must give consent..."
    await expect(msg).toContainText(/pëlqim|consent/i);
  });

  test('English labels render when language is English', async ({ page }) => {
    await setLanguage(page, 'en');
    await gotoRegister(page);
    await expect(page.locator('#submit-form button[type=submit]')).toHaveText(/Submit for review/i);
  });
});
