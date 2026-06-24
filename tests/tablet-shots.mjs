// Tablet screenshots for the Play listing.
//
// The Android app is a WebView (Chromium) over the live site, so rendering the
// SAME live site at true tablet viewports in Chromium is a faithful tablet
// preview. We use device-independent-pixel viewports at deviceScaleFactor 2 so
// the layout is the tablet layout (not a shrunken desktop) and the PNG is
// retina-crisp.
//
// Play tablet slots: 7-inch and 10-inch. Requirements: 320–3840 px each side,
// and the long side <= 2x the short side. All outputs below comply.
//
// Run:  cd tests && node tablet-shots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'https://albabiz.pages.dev';
const OUT = '../play-listing/screenshots-tablet';
mkdirSync(OUT, { recursive: true });

// dp viewports @2x -> physical px. Portrait stays well under the 2:1 cap.
const PROFILES = [
  { id: '10in-portrait',  w: 800,  h: 1280, dsf: 2 }, // -> 1600x2560
  { id: '7in-portrait',   w: 600,  h: 960,  dsf: 2 }, // -> 1200x1920
  { id: '10in-landscape', w: 1280, h: 800,  dsf: 2 }, // -> 2560x1600 (multi-col grid)
];

async function bootHome(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('header .cta-header').waitFor({ state: 'visible' });
  // wait for the directory to load real cards (or the empty state)
  await page.locator('#results .card, #results .state').first()
    .waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(800); // let images/fonts settle
}

async function shot(page, file) {
  await page.screenshot({ path: `${OUT}/${file}.png` });
  console.log('  saved', file);
}

const browser = await chromium.launch();
try {
  for (const p of PROFILES) {
    console.log('profile', p.id, `${p.w * p.dsf}x${p.h * p.dsf}`);
    const ctx = await browser.newContext({
      viewport: { width: p.w, height: p.h },
      deviceScaleFactor: p.dsf,
      isMobile: false,
    });
    const page = await ctx.newPage();

    // 1) Home / directory
    await bootHome(page);
    await shot(page, `${p.id}-01-home`);

    // 2) Business detail — click the first card
    const firstCard = page.locator('#results .card').first();
    if (await firstCard.count()) {
      await firstCard.click();
      await page.locator('.detail-title').waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(500);
      await shot(page, `${p.id}-02-detail`);
    }

    // 3) Register form
    await page.goto(BASE + '/regjistro', { waitUntil: 'domcontentloaded' });
    await page.locator('#submit-form').waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);
    await shot(page, `${p.id}-03-register`);

    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('done');
