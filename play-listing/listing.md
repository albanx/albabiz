# AlbaBiz.ie — Play Store listing checklist & copy

applicationId: **com.zonetech.albabiz**  ·  Category: **Business**  ·  Free  ·  Contains ads: **No**

---

## App details

**App name (30 chars max):**
`AlbaBiz`

**Short description (80 chars max):**
`Directory of Albanian-owned businesses in Ireland. Find, search & register.`

**Full description (4000 chars max):**
```
AlbaBiz.ie is the official directory of Albanian-owned businesses in Ireland —
a project of the Albanian Cultural Association Ireland (ACAI).

Browse and search hundreds of Albanian businesses across all 26 counties of the
Republic of Ireland: construction & trades, restaurants & food, beauty & barber,
automotive, cleaning, professional services, retail, IT and more.

FEATURES
• Search and filter by category, county and keyword
• List view and interactive map view
• Clean business profiles with contact details, website and social links
• Fully bilingual — Albanian (default) and English, switch any time
• Register your own business for free, directly from the app
• Works great offline-aware with pull-to-refresh

REGISTER YOUR BUSINESS
Own an Albanian business in Ireland? Add it to the directory for free. Tap
"Register your business", fill in the form (including your logo) and the ACAI
team will review and publish it.

PRIVACY-FIRST
Listings are opt-in. We only publish what you consent to publish, and you can
request removal at any time. See our privacy notice in the app.

AlbaBiz.ie is run by the Albanian Cultural Association Ireland (ACAI) to support
and connect the Albanian community and its businesses across Ireland.
```

**App icon:** ✅ `play-listing/icon-512.png` (512×512, flat) — the **AB monogram**
(cream "A" + gold "B" on flag-red), matching the Android launcher and the site
favicons (`cloud/pages/icons/`).

**Feature graphic:** ✅ `play-listing/feature-1024x500.png` — warm cream banner
with the AB monogram badge, the "AlbaBiz.ie" serif wordmark, the
"Albanian Business Network Ireland" tagline, a gold underline and a faint Celtic
line-art motif.

---

## Screenshots (required: 2–8 phone screenshots, min 320px, 16:9 or 9:16)

✅ Captured on the Samsung Galaxy S10 (1080×2280), current AB brand:

1. `screenshots/01-home.png` — **Home / directory** (SQ): hero, search, category
   chips, "8 biznese", List/Map toggle, featured card.
2. `screenshots/02-grid.png` — **Card grid**: featured restaurant + more cards
   with category icons, bilingual descriptions.
3. `screenshots/03-detail.png` — **Business detail**: profile with About,
   Categories, Location panels and the "Kthehu te regjistri" breadcrumb.
4. `screenshots/04-register.png` — **Register form**: the "Logo & të tjera"
   section showing the **camera-first** logo upload + "Or choose from gallery"
   fallback, GDPR consent and the Turnstile anti-spam check (native value).
5. `screenshots/05-home-en.png` — **English UI**: same home in English, proving
   the bilingual toggle.

(All 1080×2280 PNG. A map-view shot is optional and can be added later.)

### Tablet screenshots (optional but recommended — 7-inch & 10-inch slots)

✅ Rendered from the live site in Chromium (the WebView engine) at true tablet
viewports @2x, so they show the genuine responsive tablet layout (multi-column
grid; two-column detail page). In `screenshots-tablet/`:

**10-inch (1600×2560 portrait / 2560×1600 landscape):**
- `10in-portrait-01-home.png`, `10in-portrait-02-detail.png`, `10in-portrait-03-register.png`
- `10in-landscape-01-home.png` (3-column grid), `10in-landscape-02-detail.png`
  (two-column profile: About/Categories/Location + Contact card), `10in-landscape-03-register.png`

**7-inch (1200×1920 portrait):**
- `7in-portrait-01-home.png`, `7in-portrait-02-detail.png`, `7in-portrait-03-register.png`

Regenerate with `cd tests && node tablet-shots.mjs`. All within Play limits
(320–3840 px per side; long side ≤ 2× short side).

---

## Required URLs

- **Privacy policy URL** (mandatory): `https://albabiz.pages.dev/privatesia`
  (resolves 200, bilingual; or `https://albabiz.ie/privatesia` once the domain is live).
- **Support email:** `info@acaireland.ie` (ACAI).
- **Website:** `https://albabiz.pages.dev` (→ `https://albabiz.ie`).

---

## Pre-launch checklist

- [x] Release AAB signed with the upload key (`android/app/build/outputs/bundle/release/app-release.aab`, 1.4 MB, signer `CN=AlbaBiz.ie`).
- [x] `UI_BASE` / `API_BASE` point at the real deployment.
- [x] Privacy policy URL resolves and is bilingual.
- [ ] Data safety form completed (see `data-safety.md`).
- [ ] Content rating questionnaire completed (see `content-rating.md`).
- [x] 5 screenshots + feature graphic + 512 icon ready (all current AB brand).
- [x] 9 tablet screenshots (7-inch + 10-inch, portrait & landscape) in `screenshots-tablet/`.
- [x] Privacy contact email in `privatesia.html` set to `info@acaireland.ie` (ACAI).
- [ ] Target audience: **18+ / general** (no child-directed content).

---

## Avoiding the "low-effort WebView wrapper" rejection

Google rejects apps that are *only* a website in a WebView with no native value.
AlbaBiz adds genuine native function — make sure your store listing and the
build reflect it:

- Native **splash screen** + adaptive **app icon** (not the default).
- **Pull-to-refresh** gesture.
- Native **offline screen** with Retry (test it in airplane mode).
- **File upload** from the device (logo) wired through `onShowFileChooser`.
- Hardware **back-button** navigation handled natively.
- External intents for **tel/mailto/WhatsApp/maps**.

If a reviewer still pushes back, emphasize that the app is the official channel
for a community organisation (ACAI) providing a real directory service, and
point to the bilingual UX and the in-app registration flow.
