# AlbaBiz.ie — End-to-End Tests (Playwright)

Browser tests for the **web** parts of AlbaBiz.ie:

| Spec | Covers |
|------|--------|
| `e2e/home.spec.js` | Landing/directory: hero, search, category chips, business cards, detail navigation, county filter, list/map toggle, empty state, SQ↔EN language toggle. |
| `e2e/register.spec.js` | `/regjistro` form: all sections render, **single-select** category dropdown, county populate, Turnstile mount, client-side validation (empty name, missing GDPR consent). |
| `e2e/admin.spec.js` | `/admin/` panel: sign-in gate appears, token field, wrong token stays gated, `noindex`. Optional signed-in flow when `ADMIN_TOKEN` is provided. |

These run against a **deployed** site, because the front-end's API base is baked
into `cloud/pages/config.js` and points at the live Worker. By default they hit
`https://albabiz.pages.dev`.

## Setup

```bash
cd tests
npm install
npm run install:browsers   # downloads Chromium
```

## Run

```bash
npm test                   # all specs, headless, against albabiz.pages.dev
npm run test:headed        # watch it in a real browser
npm run test:ui            # Playwright's interactive UI mode
npm run test:home          # one spec
npm run report             # open the HTML report after a run
```

### Target a different deploy

```bash
BASE_URL=https://<preview-hash>.albabiz.pages.dev npm test
```

### Run the authenticated admin flow

The signed-in admin tests are **skipped** unless you provide the break-glass
token (so no secret is ever committed):

```bash
ADMIN_TOKEN='<your ADMIN_BREAKGLASS value>' npm run test:admin
```

## Notes

- **No real submissions.** The register spec only exercises client-side
  validation (which fires before any network call), so it never writes a row or
  needs to solve Turnstile.
- **Live data.** The home spec relies on the published demo businesses
  (`cloud/worker/seeds/demo_businesses.sql`). If the directory is empty the
  card assertions fall back to the branded empty-state.
- Artifacts (`test-results/`, `playwright-report/`) are gitignored.
