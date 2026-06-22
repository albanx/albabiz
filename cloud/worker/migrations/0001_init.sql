-- AlbaBiz.ie — D1 schema (SQLite).
-- A project of the Albanian Cultural Association Ireland (ACAI).
--
-- Apply once (remote):
--   npx wrangler d1 execute albabiz-db --remote --file=migrations/0001_init.sql
-- Or local dev:
--   npx wrangler d1 execute albabiz-db --local  --file=migrations/0001_init.sql
--
-- Design notes:
--   * A "submission" is NOT a separate table — it is simply a `businesses` row
--     with status='pending'. Admin approval flips it to 'approved' and assigns
--     a slug. This keeps moderation edit-in-place trivial.
--   * Bilingual content lives in parallel *_sq / *_en columns (Albanian default).
--   * GDPR data-minimization is enforced at the column level: owner_name is
--     never published, and show_contact=0 hides phone/whatsapp/email on the
--     public detail page. Consent + timestamp are mandatory on submit.

-- ---------------------------------------------------------------------------
-- counties: the 26 Republic of Ireland counties. Admin-manageable but seeded.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS counties (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    UNIQUE NOT NULL,   -- e.g. 'dublin'
  name_en    TEXT    NOT NULL,          -- 'Dublin'
  name_sq    TEXT    NOT NULL,          -- 'Dublin' (proper nouns mostly identical)
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- categories: fixed seed list, editable by admin (add/rename/deactivate).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    UNIQUE NOT NULL,   -- e.g. 'food-restaurants'
  name_en    TEXT    NOT NULL,
  name_sq    TEXT    NOT NULL,
  icon       TEXT,                       -- optional emoji/icon hint for UI
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1  -- 0 = hidden from public filters
);

-- ---------------------------------------------------------------------------
-- businesses: the core table. status drives the moderation lifecycle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  slug              TEXT    UNIQUE,            -- /biznes/<slug>; assigned on approve
  status            TEXT    NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|removed
  is_featured       INTEGER NOT NULL DEFAULT 0,
  featured_until    INTEGER,                   -- epoch ms; NULL = indefinite when featured

  -- Identity / description
  name              TEXT    NOT NULL,
  owner_name        TEXT,                       -- INTERNAL ONLY — never returned publicly
  description_sq    TEXT,
  description_en    TEXT,

  -- Location
  county_id         INTEGER REFERENCES counties(id),
  town              TEXT,
  address           TEXT,
  lat               REAL,                       -- nullable; geocoded by admin later
  lng               REAL,

  -- Contact (publication gated by show_contact)
  phone             TEXT,
  whatsapp          TEXT,
  email             TEXT,
  website           TEXT,
  facebook          TEXT,
  instagram         TEXT,
  linkedin          TEXT,

  -- Media
  logo_key          TEXT,                       -- R2 object key (served via /img/<key>)

  -- Misc
  year_established  INTEGER,
  show_contact      INTEGER NOT NULL DEFAULT 1,  -- 0 hides phone/whatsapp/email publicly

  -- GDPR / consent (mandatory at submit time)
  gdpr_consent      INTEGER NOT NULL DEFAULT 0,
  gdpr_consent_at   INTEGER,                     -- epoch ms when the box was ticked

  -- Provenance / audit
  submitted_ip      TEXT,
  submitted_country TEXT,
  source            TEXT    NOT NULL DEFAULT 'web',  -- web|import|admin
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  approved_at       INTEGER,
  approved_by       TEXT                          -- admin email from the Access JWT
);

-- Many-to-many: a business can sit in several categories.
CREATE TABLE IF NOT EXISTS business_categories (
  business_id INTEGER NOT NULL REFERENCES businesses(id)  ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id)  ON DELETE CASCADE,
  PRIMARY KEY (business_id, category_id)
);

-- GDPR self-service removal requests (public intake -> admin processes).
CREATE TABLE IF NOT EXISTS removal_requests (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER REFERENCES businesses(id),
  business_name TEXT,                            -- free-text fallback if no id matched
  email         TEXT    NOT NULL,
  reason        TEXT,
  status        TEXT    NOT NULL DEFAULT 'open', -- open|processed|rejected
  created_at    INTEGER NOT NULL,
  processed_at  INTEGER,
  processed_by  TEXT
);

-- Moderator accountability — every admin mutation appends a row here.
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER,
  action      TEXT    NOT NULL,                  -- approve|reject|edit|feature|unfeature|remove|removal_process
  actor       TEXT,                              -- admin email
  detail      TEXT,                              -- optional JSON/string context
  created_at  INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Indexes — sized for the common public + admin queries.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_biz_status      ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_biz_county      ON businesses(county_id);
CREATE INDEX IF NOT EXISTS idx_biz_featured    ON businesses(is_featured);
CREATE INDEX IF NOT EXISTS idx_biz_created     ON businesses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bizcat_category ON business_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_removal_status  ON removal_requests(status);

-- Free-text search (name + descriptions) currently uses LIKE in the Worker.
-- If/when the directory grows, drop in an FTS5 virtual table mirroring
-- name/description_sq/description_en and switch the q filter to MATCH.
