# AlbaBiz.ie — UX Redesign + Metrics Plan

_Status: PLAN (awaiting approval before implementation)._
_Decisions locked: Editorial & warm design · Logos + category art + curated stock · Anonymous cookieless analytics in D1 · Build after approval._

This plan replaces the current "AI-looking" v1 UI (emoji icons, flag-red gradient,
generic system font) with a deliberate, warm, editorial design system, swaps all
emoji for a real icon set, adds curated imagery, and introduces a privacy-friendly
analytics pipeline (clicks, popular businesses/searches, device/browser/country)
stored in your own D1 — no Google, no cookie banner.

---

## Part A — Design system: "Editorial & warm"

### A1. The problem with v1 (what reads as "AI/generic")
- **Emoji as UI icons** (🏬 📞 🔨 🍽️ …) — the #1 tell. Inconsistent across
  platforms, toy-like, not brand.
- **Flag-red gradient hero** + pure-white everywhere — the default "tutorial" look.
- **System sans for everything** — no typographic personality.
- **Evenly-weighted cards** with no hierarchy or editorial rhythm.

### A2. Colour palette (warm, trust-first; red as accent not background)

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FAF7F2` | page background (warm cream, not white) |
| `--surface` | `#FFFFFF` | cards, panels |
| `--ink` | `#1C1B19` | primary text (warm near-black) |
| `--ink-soft` | `#4A4742` | secondary text |
| `--muted` | `#807A70` | meta text, captions |
| `--line` | `#E8E2D9` | hairline borders (warm) |
| `--red` | `#C8102E` | **the** accent — official Albanian flag red, used sparingly |
| `--red-deep` | `#9E0C24` | hover/active, headings touch |
| `--red-wash` | `#FBEDEC` | selected chips, subtle fills |
| `--gold` | `#B8893A` | rare secondary accent (featured star, dividers) |
| `--ok` / `--warn` | `#2E7D52` / `#9A6700` | status |

Rationale: cream + warm greys + a single confident red = local-institution trust
(think a respected community paper), the opposite of cold SaaS white. Gold is a
restrained nod to the eagle without going full flag.

### A3. Typography
- **Display / headings:** **Fraunces** (Google Fonts, OFL, free commercial) — a
  warm "old-style" variable serif with optical sizing. Gives editorial character.
- **Body / UI:** **Inter** (or **Geist**) — neutral, legible sans for body, labels,
  buttons.
- **Albanian diacritics:** both fonts cover ë/ç fully (verified glyph coverage).
- Scale: fluid `clamp()` ramp; headings tighter tracking, generous line-height on body.
- Self-host the two fonts under `/fonts/` (woff2) so the WebView/app isn't
  blocked on Google and we avoid a third-party GDPR hop.

### A4. Icon system — replace ALL emoji with **Lucide**
- **Lucide** (lucide.dev): 1,743 icons, **ISC license** (free commercial), tree-
  shakable, available via CDN or inline SVG. Consistent 1.5px stroke = editorial.
- Approach: **inline SVG sprite** (no runtime JS dep) — we bundle only the ~30
  icons we use into one `icons.svg` and reference via `<use>`. Keeps it offline-
  safe in the WebView and fast.
- Category icons: map each of the 15 categories to a Lucide glyph (e.g.
  Construction→`hard-hat`, Food→`utensils-crossed`, Beauty→`scissors`,
  Automotive→`car`, Cleaning→`spray-can`, IT→`monitor`, Health→`heart-pulse`,
  Transport→`truck`, Real estate→`home`, Education→`graduation-cap`, Retail→
  `shopping-bag`, Professional→`briefcase`, Grocery→`shopping-cart`, Car wash→
  `droplets`, Other→`circle-dot`). Stored as the icon key in the DB (migration to
  swap the seeded emoji for Lucide names).
- Contact/action icons (phone, whatsapp, mail, globe, map-pin, share, chevrons)
  all from the same set → visual consistency.

### A5. Component redesign (what changes, concretely)
- **Header:** cream, hairline bottom border, Fraunces wordmark "AlbaBiz" with a
  small eagle/dot mark, language toggle as understated pill, **Register** as the
  one red button. Sticky, slim.
- **Hero:** drop the red gradient. Warm cream band, a confident serif headline,
  a single prominent **search bar** (rounded, generous), and a row of category
  icon-chips beneath. Optional subtle background texture (very low-opacity).
- **Business cards:** editorial layout — logo/category-art top, name in Fraunces,
  county·town meta with a `map-pin` icon, 2-line description, category tags as
  quiet outline chips, a subtle hover lift. Featured = a small gold star, not a
  loud red badge.
- **Detail page:** larger logo, serif H1, a clean two-column (about / contact
  card), contact rows with Lucide icons + tap targets, a real **map** with a
  custom red `map-pin`, "Directions / WhatsApp / Call / Website" as icon buttons.
- **Forms:** same fields, but grouped with section headers in serif, better
  spacing, real focus states in red-wash, the consent box restyled as a warm
  callout (not alarming pink). Turnstile sits in a labelled row.
- **Empty/loading states:** branded — a small line-art mark + a sentence, not a
  bare spinner. Skeleton cards use the warm palette.
- **Accessibility:** keep/extend WCAG AA — all text passes contrast on cream;
  focus-visible rings; reduced-motion respected; min 44px tap targets.

### A6. Map restyle
- Keep Leaflet + OpenStreetMap (free), but switch to a softer tile set
  (CARTO Positron — free, muted, matches cream) and a custom red SVG pin so it's
  on-brand instead of the default blue marker.

---

## Part B — Imagery & graphics (logos + category art + curated stock)

### B1. Category art (for cards with no logo)
- Instead of a stock photo per category, a set of **15 custom flat illustrations
  /patterns** in the palette (cream + red + gold line art) — one per category.
  Original, license-free, tiny, on-brand, and they make the empty grid look
  intentional. Generated as simple SVGs.

### B2. Hero / landing imagery (curated stock)
- A small, hand-picked set of warm photos (Irish/Albanian shopfronts, food,
  trades, markets) for the home hero and the SEO county/category landing pages.
- **Sources (free, commercial-OK):**
  - **Unsplash** (unsplash.com/license) — commercial use, **no attribution
    required**, may not be sold unmodified or used to build a competing image
    service. ✅ verified.
  - **Pexels** (pexels.com/license) — free commercial, no attribution required.
  - **openverse.org** — filter to CC0 / commercial-allowed.
- We **download + self-host** a curated handful (optimised webp), never hot-link.
  A short `play-listing/credits.md` will list source URLs even though attribution
  isn't required (good practice).

### B3. Brand mark / icon refresh
- Replace the current data-URI "A in a red circle" with a proper **AlbaBiz mark**:
  a simple geometric eagle-head or "A" lockup in red/ink, delivered as SVG +
  exported PNGs (favicon, the Android adaptive icon, the 512 Play icon, the
  1024×500 feature graphic). This also upgrades the Android launcher icon.

### B4. Asset inventory to produce
- `icons.svg` sprite (~30 Lucide glyphs)
- 15 category illustration SVGs
- 1 brand mark (SVG) + favicon + Android icons + Play feature graphic
- 3–6 curated hero/landing photos (webp) + `credits.md`
- 2 self-hosted fonts (Fraunces, Inter) woff2

---

## Part C — Analytics / metrics (anonymous, cookieless, in your D1)

You asked to capture: where users click, what they do most, device id, browser,
etc. This does that **without** a consent banner by staying anonymous and
cookieless (no persistent identifier, no PII) — lawful under GDPR/ePrivacy as
"strictly functional" measurement.

### C1. What we collect (and explicitly DON'T)
**Collect (per event):**
- event type (see C2), the page path / business slug / search term / filter value
- **device class** (mobile/tablet/desktop) + **browser family** + **OS** (parsed
  from User-Agent, coarse — not a fingerprint)
- **country** (from Cloudflare `request.cf.country`) — never full IP stored
- referrer host (coarse), language (sq/en), app-vs-web flag
- a **rotating daily visitor hash** = SHA-256(salt-of-the-day + IP + UA),
  truncated. Lets us count "unique visitors today" and dedupe, but it **cannot**
  be linked across days or back to a person (the salt rotates and we never store
  IP). This is the cookieless trick that keeps us banner-free.

**Never collect:** full IP, precise location, cross-day identity, names, any
form-field contents, anything that needs consent.

### C2. Event taxonomy
| Event | Fired when | Key fields |
|---|---|---|
| `page_view` | any SPA route render | path, lang, ref |
| `search` | search submitted | query (truncated), result_count |
| `filter` | category/county chip used | filter_type, value |
| `view_toggle` | list⇄map switch | value |
| `business_view` | detail page opened | slug |
| `contact_click` | call/whatsapp/email/website/directions tapped | slug, channel |
| `submit_start` / `submit_success` | register form | — |
| `outbound` | social/website link out | slug, host |

### C3. Storage (new D1 table)
```
events(
  id, ts, type, path, slug, query, filter_type, filter_value, result_count,
  channel, lang, app_flag, device_class, browser, os, country, ref_host,
  visitor_day_hash
) + indexes on (ts), (type, ts), (slug, ts)
```
Roll-ups computed at read time (like the zonetech metrics pattern), so no extra
write cost. Optional nightly cron later to pre-aggregate if volume grows.

### C4. Worker endpoints
- `POST /api/events` — public, **batched** (client buffers ~10 events / 5s and
  flushes; also flushes on page hide). Server stamps `ts`, parses UA, derives
  country + visitor_day_hash, validates against the event whitelist, caps batch
  size (anti-abuse, mirrors the zonetech `/api/events` design).
- `GET /api/admin/metrics/overview?since=&until=` — Access/token gated:
  totals (views, visitors, searches), top businesses, top searches (with
  zero-result searches highlighted — gold for "demand we don't serve yet"), top
  categories/counties, device/browser/country split, daily timeseries, contact-
  click leaderboard.

### C5. Client tracker (`metrics.js`)
- Tiny (~2KB), no dependency. Exposes `albabizTrack(type, props)`; the SPA router
  calls it on each view, and delegated click handlers fire `contact_click` /
  `outbound` / `filter`. Buffers + flushes via `navigator.sendBeacon` so it never
  blocks UX and survives page-close.
- App-vs-web: the Android shell sets a flag (`?app=1` or a JS bridge boolean) so
  you can compare app vs browser usage.

### C6. Admin dashboard (new tab in `/admin`)
- A **Metrics** tab: date-range picker, headline cards, sortable "Top businesses
  by profile views", "Top searches", "Searches with 0 results" (product gold),
  "Contact clicks by channel", device/browser/country bars, and a daily line
  chart. Pure vanilla + a tiny inline SVG chart (no chart lib) to stay buildless.

### C7. Privacy alignment (so it stays banner-free)
- Update `privatesia.html`: a short "Anonymous usage measurement" paragraph (what
  we count, that it's anonymous/cookieless, no third parties, retention window).
- Add a retention rule: purge raw `events` older than N months (e.g. 12) via a
  scheduled cron; keep only aggregates beyond that.
- Update `play-listing/data-safety.md`: still "no data shared / no tracking across
  apps" (true — it's first-party, anonymous, non-cross-app).

---

## Part D — Implementation phases (after approval)

1. **Design tokens & foundation** — new palette, self-hosted fonts, `icons.svg`
   sprite, base CSS rewrite. Swap emoji→Lucide across `app.js`/admin. _(visual
   reskin, no behaviour change)_
2. **Component redesign** — header, hero, cards, detail, forms, map restyle,
   empty/loading states. Brand mark + favicon.
3. **Category illustrations + curated hero imagery** + `credits.md`; DB migration
   to replace seeded emoji icon keys with Lucide names.
4. **Metrics pipeline** — `events` table + migration, `POST /api/events`,
   `metrics.js` client, wire SPA + click handlers, app flag.
5. **Admin metrics dashboard** + privacy/data-safety copy updates + retention cron.
6. **Android refresh** — new launcher/splash icon from the brand mark; verify the
   reskinned UI in the WebView; rebuild APK.
7. **QA** — re-run the live API tests, Lighthouse/contrast pass, redeploy Pages +
   Worker, screenshot pass for Play.

Each phase is independently deployable (the reskin ships before metrics, etc.).

---

## Part E — Open items to confirm before/at build time
- **Brand mark direction:** eagle-head vs monogram "A" — want me to produce 2–3
  SVG options to pick from in Phase 2?
- **Font pairing:** Fraunces + Inter is the recommendation; happy to show Fraunces
  + Geist or a Libre Franklin alternative as a quick comparison.
- **Visitor counting:** the rotating-daily-hash gives "unique per day". If you
  ever want true returning-user retention, that needs the persistent-id + consent
  banner route (the option you declined) — easy to add later.
- **Stock photos:** I'll propose a specific shortlist (with thumbnails/links) in
  Phase 3 for your yes/no before anything ships.

---

## Sources
- Lucide icons — https://lucide.dev/ (ISC license, 1,743 icons)
- Fraunces font — https://fonts.google.com/specimen/Fraunces (OFL, free commercial)
- Inter font — https://fonts.google.com/specimen/Inter (OFL)
- Unsplash license — https://unsplash.com/license (commercial OK, no attribution required)
- Pexels license — https://www.pexels.com/license/
- Openverse (CC search) — https://openverse.org/
- CARTO basemaps (map tiles) — https://carto.com/basemaps/
