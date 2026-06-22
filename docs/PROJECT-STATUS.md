# AlbaBiz.ie — Project Status & Deployment Record

_A project of the Albanian Cultural Association Ireland (ACAI)._
_Last updated: 2026-06-22 (v2 — editorial redesign + anonymous analytics)._

This document records everything that has been built and deployed, the live
endpoints, the data model, and the operational commands. It is the single source
of truth for "what exists and where."

---

## 1. Live resources

| Layer | Value | Status |
|---|---|---|
| **Public site (Pages)** | https://albabiz.pages.dev | ✅ live |
| **Admin panel** | https://albabiz.pages.dev/admin | ✅ live (token-gated) |
| **Privacy notice** | https://albabiz.pages.dev/privatesia | ✅ live (bilingual) |
| **Worker API** | https://albabiz-api.albanx.workers.dev | ✅ deployed |
| **D1 database** | `albabiz-db` · id `9eabeb32-7a89-4265-9e1a-e266b00e02b3` | ✅ 26 counties, 15 categories |
| **R2 bucket** | `albabiz-logos` (binding `LOGOS`) | ✅ created + bound |
| **Cloudflare account** | albanx@gmail.com · `84a529d7222b56ae74680de21b800c3f` | — |

### Secrets set on the Worker (`wrangler secret list`)
- `TURNSTILE_SECRET` — Turnstile server-side key (matches site key in `config.js`).
- `ADMIN_BREAKGLASS` — bearer token for admin login while on `*.workers.dev`.

### Turnstile
- **Site key** (public, in `cloud/pages/config.js`): `0x4AAAAAADpGOZiuXBZUiBlN`
- Secret stored as the `TURNSTILE_SECRET` Worker secret.
- ⚠ **Action required:** the widget's **Hostnames** list must include
  `albabiz.pages.dev` (and `localhost` for local testing) or the widget will not
  render in the browser.

---

## 2. Frontend config (the one file to edit per environment)

`cloud/pages/config.js`:
```js
window.ALBABIZ_CONFIG = {
  API_BASE: 'https://albabiz-api.albanx.workers.dev',
  TURNSTILE_SITE_KEY: '0x4AAAAAADpGOZiuXBZUiBlN',
};
```

---

## 3. API endpoint reference

Base URL: `https://albabiz-api.albanx.workers.dev`

### Public endpoints (no auth)

| Method | Path | Query / Body | Returns |
|---|---|---|---|
| GET | `/healthz` | – | `ok` |
| GET | `/api/config` | – | `{ app_name, ui_base_override, maintenance, message, min_version_code, fetched_at }` |
| GET | `/api/counties` | – | `{ ok, counties:[{ slug, name_en, name_sq, count }] }` |
| GET | `/api/categories` | – | `{ ok, categories:[{ slug, name_en, name_sq, icon, count }] }` |
| GET | `/api/businesses` | `?county=&category=&q=&featured=1&page=&pageSize=` | `{ ok, businesses:[…], page, pageSize, total, total_pages }` |
| GET | `/api/businesses/:slug` | – | `{ ok, business:{…} }` (contact fields omitted if `show_contact=0`; `owner_name` never returned) |
| POST | `/api/submit` | multipart or JSON (see below) | `{ ok, pending:true, id }` — Turnstile + honeypot enforced |
| POST | `/api/removal-request` | JSON `{ email, slug?, business_name?, reason?, 'cf-turnstile-response' }` | `{ ok, received:true }` |
| POST | `/api/events` | JSON `{ events:[{type,...}] }` (anonymous, batched) | `{ ok, accepted }` |
| GET | `/img/:key` | – | the R2 logo image |

**`POST /api/submit` fields** (multipart so a logo can ride along):
`name`* , `owner_name`, `description_sq`, `description_en`, `categories` (repeated
or comma list of category ids), `county` (slug or id), `town`, `address`,
`phone`, `whatsapp`, `email`, `website`, `facebook`, `instagram`, `linkedin`,
`logo` (file ≤2MB png/jpg/webp), `year_established`, `show_contact` (`true`/`false`),
`gdpr_consent`* (`true`), `cf-turnstile-response`* , `company_fax` (honeypot — leave empty).
\* required.

### Admin endpoints (Access JWT **or** `Authorization: Bearer <ADMIN_BREAKGLASS>`)

| Method | Path | Body | Purpose |
|---|---|---|---|
| GET | `/api/admin/pending` | – | submissions awaiting moderation |
| GET | `/api/admin/businesses` | `?status=approved\|pending\|rejected\|removed&page=&pageSize=` | list by status |
| POST | `/api/admin/approve` | `{ id }` | approve → assigns slug, status=approved |
| POST | `/api/admin/reject` | `{ id, reason? }` | status=rejected |
| PUT | `/api/admin/business/:id` | full editable record + `category_ids[]`, `lat`, `lng` | edit |
| DELETE | `/api/admin/business/:id` | – | soft-delete (status=removed) |
| POST | `/api/admin/feature` | `{ id, featured:bool, until? }` | feature / unfeature |
| POST | `/api/admin/category` | `{ slug?, name_en, name_sq, icon? }` | create category |
| PUT | `/api/admin/category/:id` | `{ name_en?, name_sq?, icon?, is_active? }` | edit category |
| POST | `/api/admin/county` | `{ slug?, name_en, name_sq }` | create county |
| PUT | `/api/admin/county/:id` | `{ name_en?, name_sq? }` | edit county |
| GET | `/api/admin/removals` | – | GDPR removal queue |
| GET | `/api/admin/metrics/overview` | `?since=&until=` | analytics rollups (totals, top businesses/searches, zero-result searches, contact clicks, device/browser/country, daily series, app-vs-web) |
| POST | `/api/admin/removal/:id/process` | `{ action:'processed'\|'rejected' }` | process removal |
| GET | `/api/admin/export.csv` | – | full CSV export (incl. private fields) |

### Verified live (2026-06-22)
- `GET /healthz` → `ok`
- `GET /api/counties` → 26 · `GET /api/categories` → 15
- `POST /api/submit` without a Turnstile token → `403 turnstile_failed` (enforcement confirmed)

---

## 4. Data model (D1)

Tables (full schema in `cloud/worker/migrations/0001_init.sql`):

- **counties** — `id, slug, name_en, name_sq, sort_order` (26 seeded)
- **categories** — `id, slug, name_en, name_sq, icon, sort_order, is_active` (15 seeded)
- **businesses** — core record; `status` (pending|approved|rejected|removed),
  `slug`, `is_featured`, bilingual descriptions, location (`county_id, town,
  address, lat, lng`), contact (`phone, whatsapp, email, website, facebook,
  instagram, linkedin`), `logo_key`, `show_contact`, `gdpr_consent` + timestamp,
  provenance (`source, submitted_ip, approved_by`…)
- **business_categories** — M:N join
- **removal_requests** — GDPR intake queue
- **audit_log** — every admin mutation
- (planned) **events**, **push_tokens** — see the UX/metrics plan

GDPR enforcement points: `owner_name` never returned publicly; `show_contact=0`
hides phone/email/whatsapp; consent timestamp mandatory at submit.

---

## 5. Android app

- Project: `android/` (Android Studio, AGP 8.5.2 / Gradle 8.10.2).
- `applicationId` = **`com.zonetech.albabiz`** (permanent once published).
- Builds a 3.3 MB debug APK (`./gradlew :app:assembleDebug`, verified).
- WebView shell → loads `UI_BASE` (currently `https://albabiz.pages.dev/`).
- Native: splash, adaptive icon, pull-to-refresh, offline screen, file upload
  (logo), back-button → `window.albabizOnBack()`, remote-config override via
  `/api/config`.
- ⚠ Update `UI_BASE`/`API_BASE` in `android/app/build.gradle.kts` are already set
  to the live URLs except `API_BASE` still shows `YOUR-SUBDOMAIN` — set it to
  `https://albabiz-api.albanx.workers.dev` before building a release.

---

## 6. Operational commands

```bash
# --- Worker (from cloud/worker) ---
npx wrangler deploy                       # deploy API
npx wrangler tail                         # live logs
npx wrangler secret list                  # check secrets
npx wrangler d1 execute albabiz-db --remote --command="SELECT COUNT(*) FROM businesses;"

# --- Pages (from cloud/pages) ---
npx wrangler pages deploy . --project-name albabiz

# --- D1 migrate/seed (from cloud/worker) ---
npx wrangler d1 execute albabiz-db --remote --file=migrations/0001_init.sql
npx wrangler d1 execute albabiz-db --remote --file=migrations/0002_seed.sql

# --- Android (from android/) ---
./gradlew :app:assembleDebug              # debug APK
./gradlew :app:bundleRelease              # release AAB (needs signing config)
```

---

## 7. Deployment checklist status

- [x] Step 1 — D1 created + schema + seed (26/15)
- [x] Step 2 — R2 bucket `albabiz-logos` created + bound (`LOGOS`)
- [x] Step 3 — `TURNSTILE_SECRET` + `ADMIN_BREAKGLASS` set
- [x] Step 4 — Worker deployed (`albabiz-api.albanx.workers.dev`)
- [x] Step 5 — Pages deployed (`albabiz.pages.dev`)
- [ ] Turnstile widget hostnames include `albabiz.pages.dev`
- [ ] Seed demo businesses (for screenshots / launch)
- [x] Android `API_BASE` set to live Worker URL
- [ ] Custom domain `albabiz.ie` (optional, enables full Cloudflare Access)
- [x] UX overhaul + metrics (see `docs/UX-METRICS-PLAN.md`) — shipped v2

---

## 8. v2 changelog (editorial redesign + analytics)

**Design system ("Editorial & warm"):**
- New palette: warm cream `--paper #faf7f2`, charcoal `--ink #1c1b19`, single
  Albanian-flag-red accent `--red #c8102e`, restrained gold.
- Self-hosted variable fonts (GDPR-clean, no Google request): **Fraunces**
  (display serif) + **Inter** (UI), latin + latin-ext for full ë/ç. Files in
  `cloud/pages/fonts/`.
- **All emoji replaced with real vector icons**: Lucide (ISC) + Simple Icons
  (CC0) compiled into `cloud/pages/icons.js` (35 + 4 glyphs). Category→glyph map
  in both `app.js` and the DB (`icon` column, migration 0004).
- New **brand mark** (`brand-mark.svg`) — geometric "A" w/ red keystone; also the
  favicon and the Android launcher/splash icon.
- Map restyled: CARTO Positron tiles + custom red SVG pin.
- Verified live in-browser (0 console errors, real data render).

**Anonymous analytics (cookieless, first-party in D1):**
- New `events` table (migration `0003_events.sql`).
- `POST /api/events` — batched ingest; server parses coarse device/browser/OS,
  country (Cloudflare), and a **rotating daily visitor hash** (no raw IP, not
  cross-day, no cookie → no consent banner). `src/metrics.js`.
- `GET /api/admin/metrics/overview` — rollups.
- Client tracker `cloud/pages/metrics.js` (`sendBeacon`, ~2KB) wired into the SPA
  (page_view, search incl. zero-result, filter, view_toggle, business_view,
  contact_click, submit funnel). Android shell appends `?app=1` for app-vs-web.
- New **Metrics tab** in `/admin` (headline cards, top businesses/searches,
  zero-result searches, contact-click split, device/browser/country bars, daily
  SVG line chart).
- Privacy: `privatesia.html` gained a bilingual "Anonymous usage measurement"
  section; `play-listing/data-safety.md` updated. 12-month retention intent.
- **Proven end-to-end live**: real browser visit → event ingested → stored with
  parsed UA (Chrome/Windows/desktop) + country (IE) + visitor hash.

**New files:** `cloud/pages/{icons.js, metrics.js, brand-mark.svg, fonts/*}`,
`cloud/worker/src/metrics.js`, `cloud/worker/migrations/{0003_events.sql,
0004_icons.sql}`.

**Still pending (nice-to-have, from the plan):** curated hero/landing stock
photos + 15 bespoke category illustrations + a retention cron — deferred; the
icon tiles + palette already make logo-less cards look intentional.
