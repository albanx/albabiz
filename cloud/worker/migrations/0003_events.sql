-- AlbaBiz.ie — analytics events (D1). Anonymous, cookieless, first-party.
-- One row per tracked interaction. Rolled up at read time by
-- /api/admin/metrics/overview. No PII: no full IP, no cross-day identity.
--
-- Apply:
--   npx wrangler d1 execute albabiz-db --remote --file=migrations/0003_events.sql

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,        -- server receive time (ms epoch)
  type          TEXT    NOT NULL,        -- page_view|search|filter|view_toggle|business_view|contact_click|outbound|submit_start|submit_success
  path          TEXT,                    -- SPA path for page_view
  slug          TEXT,                    -- business slug (business_view / contact_click)
  query         TEXT,                    -- search term (truncated)
  filter_type   TEXT,                    -- 'category' | 'county' | 'view'
  filter_value  TEXT,
  result_count  INTEGER,                 -- search result count (incl. 0 = unmet demand)
  channel       TEXT,                    -- contact channel: phone|whatsapp|email|website|directions|facebook|instagram|linkedin
  lang          TEXT,                    -- 'sq' | 'en'
  app_flag      INTEGER DEFAULT 0,       -- 1 = from the Android app shell, 0 = web
  device_class  TEXT,                    -- mobile|tablet|desktop|bot
  browser       TEXT,                    -- coarse family (Chrome/Safari/Firefox/…)
  os            TEXT,                    -- coarse (Android/iOS/Windows/macOS/Linux)
  country       TEXT,                    -- from Cloudflare request.cf.country
  ref_host      TEXT,                    -- referrer host only (coarse)
  visitor_day   TEXT                     -- rotating daily hash (NOT cross-day, NOT a person)
);

-- Read-path indexes: time-window scans, per-type counters, per-business rollups.
CREATE INDEX IF NOT EXISTS idx_events_ts        ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts   ON events(type, ts);
CREATE INDEX IF NOT EXISTS idx_events_slug_ts   ON events(slug, ts);
CREATE INDEX IF NOT EXISTS idx_events_visitor   ON events(visitor_day);
