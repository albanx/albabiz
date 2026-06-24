# AlbaBiz.ie — Albanian Business Network Ireland

A bilingual (Albanian / English) directory of Albanian-owned businesses in
Ireland. A project of the **Albanian Cultural Association Ireland (ACAI)**.

Businesses self-register (opt-in) → an ACAI admin moderates → approved listings
appear in a public, searchable directory (list + map). **Android app first**, web
version reuses the exact same frontend.

## Architecture — 100% Cloudflare, no separate backend server

```
 Android app (Kotlin WebView shell)  ─┐
 Web browser                          ─┴─►  Cloudflare Pages  (static UI: HTML/CSS/JS)
                                                   │  fetch()
                                                   ▼
                                          Cloudflare Worker   (the entire API)
                                                   │
                        ┌──────────────────────────┼───────────────────────────┐
                        ▼                           ▼                           ▼
                  D1 (SQLite)                  R2 (logos)                 Turnstile
            businesses/categories/         business logo images        spam protection
            counties/removals/audit                                    on public forms

  Admin (/admin + /api/admin/*) ── protected by Cloudflare Access (Zero Trust) ──► Worker verifies the JWT
```

Everything fits the Cloudflare **free tier** at small/medium scale.

## Repository layout

```
albabiz.ie/
├─ cloud/
│  ├─ worker/                 Cloudflare Worker = the whole API
│  │  ├─ src/
│  │  │  ├─ index.js          router + all route handlers
│  │  │  ├─ access.js         Cloudflare Access JWT verification (admin auth)
│  │  │  └─ util.js           json/cors/validators/slugify helpers
│  │  ├─ migrations/
│  │  │  ├─ 0001_init.sql     D1 schema
│  │  │  └─ 0002_seed.sql     26 counties + 15 categories (bilingual)
│  │  ├─ wrangler.toml        bindings (D1, R2), vars; secrets set via CLI
│  │  ├─ package.json
│  │  └─ .dev.vars.example    local dev secrets template
│  └─ pages/                  Cloudflare Pages = the UI (and the WebView target)
│     ├─ index.html  app.js  styles.css  i18n.js  config.js
│     ├─ privatesia.html      bilingual GDPR privacy notice
│     ├─ _redirects  _headers  robots.txt
│     └─ admin/               admin SPA (index.html, app.js, styles.css)
├─ android/                   Android Studio project (Kotlin WebView shell)
│  └─ app/src/main/…          MainActivity (WebView), AlbaBizApp (remote config)
├─ tools/
│  └─ import-csv.mjs          Google Form CSV → D1 pending queue
├─ play-listing/              Play Store listing + data-safety + content rating
└─ README.md
```

---

## Prerequisites

- A **Cloudflare account** (free) and the **Wrangler CLI**:
  ```bash
  npm i -g wrangler         # or use npx wrangler everywhere
  wrangler login
  ```
- **Node.js 18+** (for the Worker tooling and the CSV importer).
- **Android Studio** (Koala/Ladybug or newer) for the Android app. The project
  builds with **AGP 8.5.2 / Gradle 8.10.2 / JDK 17+** (Android Studio's bundled
  JBR works).

---

## 1. Deploy the Worker API + D1 + R2

All commands run from `cloud/worker/`.

```bash
cd cloud/worker
npm install
```

### 1a. Create D1 and apply schema + seed

```bash
wrangler d1 create albabiz-db
# → copy the printed database_id into wrangler.toml ([[d1_databases]].database_id)

# schema + seed (remote = the real cloud DB)
wrangler d1 execute albabiz-db --remote --file=migrations/0001_init.sql
wrangler d1 execute albabiz-db --remote --file=migrations/0002_seed.sql
```

### 1b. Create the R2 bucket (logo storage)

```bash
wrangler r2 bucket create albabiz-logos
# binding name LOGOS is already wired in wrangler.toml — no id to paste
```

### 1c. Set secrets

```bash
# Turnstile secret key (from the Turnstile widget you create in step 3)
wrangler secret put TURNSTILE_SECRET

# Optional break-glass admin token (needed NOW while the API is on *.workers.dev;
# see the Admin auth note below). Generate a long random hex string:
wrangler secret put ADMIN_BREAKGLASS
```

### 1d. Deploy

```bash
wrangler deploy
# → note the URL, e.g. https://albabiz-api.<your-subdomain>.workers.dev
```

Quick check:

```bash
curl https://albabiz-api.<your-subdomain>.workers.dev/healthz          # → ok
curl https://albabiz-api.<your-subdomain>.workers.dev/api/counties     # → 26 counties
curl https://albabiz-api.<your-subdomain>.workers.dev/api/categories   # → 15 categories
```

### Local development

```bash
cp .dev.vars.example .dev.vars          # DEV_SKIP_TURNSTILE + DEV_ADMIN_BYPASS
wrangler d1 execute albabiz-db --local --file=migrations/0001_init.sql
wrangler d1 execute albabiz-db --local --file=migrations/0002_seed.sql
wrangler dev                            # http://localhost:8787
```
`DEV_ADMIN_BYPASS=1` makes every `/api/admin/*` call succeed as `dev@localhost`,
so you can build/admin locally before standing up Access.

---

## 2. Deploy the Pages frontend

1. **Point the UI at your Worker.** Edit `cloud/pages/config.js`:
   ```js
   window.ALBABIZ_CONFIG = {
     API_BASE: 'https://albabiz-api.<your-subdomain>.workers.dev',
     TURNSTILE_SITE_KEY: '<your Turnstile SITE key>',
   };
   ```
2. **Create + deploy the Pages project:**
   ```bash
   cd cloud/pages
   wrangler pages project create albabiz --production-branch main
   wrangler pages deploy . --project-name albabiz
   # → https://albabiz.pages.dev
   ```
3. **Add the Pages origin to the Worker's CORS allow-list.** In `wrangler.toml`,
   `ALLOWED_ORIGINS` already includes `https://albabiz.pages.dev`. If your Pages
   URL differs, update it and `wrangler deploy` again.

Open `https://albabiz.pages.dev` — you should see the directory. Submit a test
business via **Register your business**; it lands in the admin **Pending** queue.

---

## 3. Cloudflare Turnstile (spam protection)

1. Dashboard → **Turnstile** → **Add widget**.
2. Hostnames: add `albabiz.pages.dev` (and `localhost` for dev).
3. Copy the **Site key** → `cloud/pages/config.js` (`TURNSTILE_SITE_KEY`).
4. Copy the **Secret key** → `wrangler secret put TURNSTILE_SECRET` (step 1c).

The submission + removal forms render the widget; the Worker verifies it
server-side.

---

## 4. Admin authentication — Cloudflare Access

> **Important architectural note.** Cloudflare Access can only sit in front of
> hostnames in a **zone you control** (a custom domain). It **cannot** protect a
> `*.workers.dev` or `*.pages.dev` URL. So there are two phases:

### Phase A — now, on free subdomains (break-glass token)

While the API is on `*.workers.dev`, the admin panel authenticates with the
`ADMIN_BREAKGLASS` token you set in step 1c. Open `https://albabiz.pages.dev/admin`,
and when prompted paste that token (kept in `sessionStorage` only). This is the
same "signin token" model as the reference zonetech project. The Worker's
`verifyAccess()` accepts it as `Authorization: Bearer <token>`.

You can also restrict who reaches `/admin` by adding **Cloudflare Access** in
front of the Pages route `albabiz.pages.dev/admin` (Pages domains *can* be
protected) — that gates the UI, while the token gates the API.

### Phase B — later, with the custom domain albabiz.ie (full Zero Trust)

Once `albabiz.ie` (UI) and `api.albabiz.ie` (Worker custom domain) are on
Cloudflare:

1. Zero Trust → **Access → Applications → Add → Self-hosted**.
2. Application domains: `albabiz.ie/admin` **and** `api.albabiz.ie/api/admin`.
3. Identity: enable **Google** and/or **One-time PIN** (email OTP).
4. Policy: **Allow** → emails/email-domain of the 1–5 ACAI moderators.
5. Copy the application **AUD** tag and your team domain
   (`<team>.cloudflareaccess.com`), then set them on the Worker:
   ```toml
   # wrangler.toml [vars]
   ACCESS_TEAM_DOMAIN = "<team>.cloudflareaccess.com"
   ACCESS_AUD = "<the AUD tag>"
   ```
   `wrangler deploy`. The Worker now verifies the `Cf-Access-Jwt-Assertion` JWT
   on every `/api/admin/*` call (`src/access.js`). The break-glass token becomes
   optional backup.

The admin SPA tries the Access cookie path first (`credentials: 'include'`) and
falls back to the token gate, so **the same code works in both phases**.

---

## 5. Android app (v1)

Open `android/` in Android Studio. It builds out of the box.

1. **Point it at your deployment.** In `android/app/build.gradle.kts`:
   ```kotlin
   buildConfigField("String", "UI_BASE",  "\"https://albabiz.pages.dev/\"")
   buildConfigField("String", "API_BASE", "\"https://albabiz-api.<your-subdomain>.workers.dev\"")
   ```
   (These can be repointed later **without** an app update via the Worker's
   `GET /api/config` → `ui_base_override`.)
2. **Build a debug APK:**
   ```bash
   cd android
   ./gradlew :app:assembleDebug
   # → app/build/outputs/apk/debug/app-debug.apk
   ```
3. **Release signing** (for Play). Create an upload keystore, then put these in
   `~/.gradle/gradle.properties` (never commit them):
   ```
   AB_KEYSTORE_PATH=C:/projects/albabiz.ie/android/keystore/albabiz-upload.jks
   AB_KEYSTORE_PASSWORD=…
   AB_KEY_ALIAS=albabiz-upload
   AB_KEY_PASSWORD=…
   ```
   ```bash
   ./gradlew :app:bundleRelease     # → app/build/outputs/bundle/release/app-release.aab
   ```

**applicationId:** `com.zonetech.albabiz` (reuses the existing Play publisher
namespace). **This is permanent once published.**

### What makes it more than a bare WebView (Play review)

- Native **splash screen** (androidx core-splashscreen) + adaptive **app icon**.
- **Pull-to-refresh** (only when scrolled to top).
- Native **offline screen** with Retry when the network is down.
- **File upload** (`onShowFileChooser`) so owners can attach a logo on the form.
- Hardware **back button** drives in-WebView history via `window.albabizOnBack()`.
- External links (`tel:`, `mailto:`, `wa.me`, other hosts, privacy page) open in
  the right app, not inside the shell.
- Remote config (`/api/config`) can show a maintenance message or repoint the UI.

> **Push notifications (FCM)** are intentionally **out of scope for v1** (your
> decision). The schema/Worker leave a clean seam: add a `push_tokens` table +
> `POST /api/push/register` + an FCM-sender admin route in v2. Nothing in v1
> blocks it.

---

## 6. Import existing Google Form responses

```bash
# 1. See how your sheet's columns map (edit COLMAP in the script if needed):
node tools/import-csv.mjs responses.csv --print-headers

# 2. Generate SQL (rows become status='pending', source='import'):
node tools/import-csv.mjs responses.csv > import.sql

# 3. Review import.sql, then apply:
cd cloud/worker
wrangler d1 execute albabiz-db --remote --file=../../import.sql
```

Imported rows start with **`gdpr_consent = 0`** on purpose — an admin must
confirm consent (e.g. your Form had a consent question) before approving. The
importer matches free-text categories to the seeded slugs and reports any it
couldn't map.

---

## 7. Going live on albabiz.ie (custom domain)

1. Add `albabiz.ie` to Cloudflare (change nameservers at your registrar).
2. Pages → **Custom domains** → add `albabiz.ie` (and `www`).
3. Worker → **Triggers → Custom Domains** → add `api.albabiz.ie`.
4. Update `cloud/pages/config.js` `API_BASE` → `https://api.albabiz.ie`.
5. Update `ALLOWED_ORIGINS` in `wrangler.toml` to include `https://albabiz.ie`.
6. Do **Phase B** of admin auth (section 4).
7. Update the Android `UI_BASE`/`API_BASE` (or just push a `/api/config`
   override and skip the re-release for the UI URL).

---

## API reference (quick)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/businesses?county=&category=&q=&featured=&page=` | – | list + filter + paginate |
| GET | `/api/businesses/:slug` | – | single business (hides contact if opted out) |
| GET | `/api/categories` / `/api/counties` | – | with live counts |
| GET | `/api/config` | – | remote app config |
| POST | `/api/submit` | Turnstile | new submission (multipart w/ logo) |
| POST | `/api/removal-request` | Turnstile | GDPR removal intake |
| GET | `/img/:key` | – | R2 logo |
| GET | `/api/admin/pending` · `/api/admin/businesses?status=` | Access/token | moderation lists |
| POST | `/api/admin/approve` · `/api/admin/reject` · `/api/admin/feature` | Access/token | moderate |
| PUT/DELETE | `/api/admin/business/:id` | Access/token | edit / soft-remove |
| POST/PUT | `/api/admin/category[/:id]` · `/api/admin/county[/:id]` | Access/token | manage taxonomies |
| GET | `/api/admin/removals` · POST `/api/admin/removal/:id/process` | Access/token | GDPR queue |
| GET | `/api/admin/export.csv` | Access/token | full CSV export |

## GDPR / data protection

- Explicit **opt-in consent** with a stored **timestamp** on every submission.
- Bilingual **privacy notice** at `/privatesia.html`.
- **Data minimization:** owner/contact name is never published; the "show
  contact publicly" toggle hides phone/email/WhatsApp.
- **Self-service removal** at `/hiq`, processed from the admin **Removals** tab.
- Admin actions are recorded in an **audit log**.

## License / ownership

Built for ACAI. The privacy contact email in `privatesia.html` is
`info@acaireland.ie` (ACAI's address).
