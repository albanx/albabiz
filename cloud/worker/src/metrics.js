/**
 * AlbaBiz.ie — analytics (anonymous, cookieless, first-party in D1).
 *
 *   POST /api/events                       public batched ingest
 *   GET  /api/admin/metrics/overview       Access/token-gated rollups
 *
 * Privacy model: we never store a full IP or any cross-day identifier. The only
 * per-visitor field is `visitor_day` = SHA-256(daySalt + ip + ua) truncated,
 * where daySalt rotates every UTC day — so it counts uniques *within a day* but
 * cannot be linked across days or back to a person. No cookie, no consent banner
 * required (strictly-functional measurement).
 */

import { json, clampStr, clampInt, toIntOrNull } from './util.js';

const EVENT_TYPES = new Set([
  'page_view', 'search', 'filter', 'view_toggle', 'business_view',
  'contact_click', 'outbound', 'submit_start', 'submit_success',
]);
const CONTACT_CHANNELS = new Set([
  'phone', 'whatsapp', 'email', 'website', 'directions',
  'facebook', 'instagram', 'linkedin',
]);
const MAX_BATCH = 50;

// ---- coarse UA parsing (no fingerprinting; broad buckets only) ------------
function parseUA(ua) {
  ua = ua || '';
  const u = ua.toLowerCase();
  let device = 'desktop';
  if (/bot|crawler|spider|crawling|headless/.test(u)) device = 'bot';
  else if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(u)) device = 'tablet';
  else if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(u)) device = 'mobile';

  let os = 'other';
  if (/android/.test(u)) os = 'Android';
  else if (/iphone|ipad|ipod|ios/.test(u)) os = 'iOS';
  else if (/windows/.test(u)) os = 'Windows';
  else if (/mac os x|macintosh/.test(u)) os = 'macOS';
  else if (/linux/.test(u)) os = 'Linux';

  let browser = 'other';
  if (/edg\//.test(u)) browser = 'Edge';
  else if (/opr\/|opera/.test(u)) browser = 'Opera';
  else if (/chrome|crios/.test(u) && !/edg\//.test(u)) browser = 'Chrome';
  else if (/firefox|fxios/.test(u)) browser = 'Firefox';
  else if (/safari/.test(u) && !/chrome|crios/.test(u)) browser = 'Safari';

  return { device, os, browser };
}

async function visitorDayHash(ip, ua, salt) {
  // Rotate by UTC date so the hash is not linkable across days.
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const data = new TextEncoder().encode(`${salt || 'albabiz'}|${day}|${ip || ''}|${ua || ''}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < 12; i++) hex += bytes[i].toString(16).padStart(2, '0'); // 24 hex chars
  return hex;
}

function refHost(ref) {
  if (!ref) return null;
  try { return new URL(ref).host || null; } catch { return null; }
}

/**
 * POST /api/events
 * Body: { events: [ { type, path?, slug?, query?, filter_type?, filter_value?,
 *                     result_count?, channel?, lang?, ref?, app? }, ... ] }
 * Server stamps ts + device/browser/os + country + visitor_day. Whitelisted,
 * batch-capped. Returns { ok, accepted }.
 */
export async function handleEvents(request, env) {
  if (!env.DB) return json({ ok: false, error: 'db_unavailable' }, { status: 503, request, env });
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, { status: 400, request, env }); }

  const events = Array.isArray(body.events) ? body.events : null;
  if (!events || !events.length) return json({ ok: false, error: 'no_events' }, { status: 400, request, env });
  if (events.length > MAX_BATCH) return json({ ok: false, error: 'batch_too_large', max: MAX_BATCH }, { status: 413, request, env });

  const ua = request.headers.get('User-Agent') || '';
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const { device, os, browser } = parseUA(ua);
  const country = request.cf?.country || null;
  const vday = await visitorDayHash(ip, ua, env.METRICS_SALT);
  const ts = Date.now();

  const insert = env.DB.prepare(
    `INSERT INTO events
      (ts, type, path, slug, query, filter_type, filter_value, result_count,
       channel, lang, app_flag, device_class, browser, os, country, ref_host, visitor_day)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)`
  );

  const stmts = [];
  let accepted = 0;
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    const type = clampStr(e.type, 24);
    if (!type || !EVENT_TYPES.has(type)) continue;
    const channel = clampStr(e.channel, 24);
    stmts.push(insert.bind(
      ts,
      type,
      clampStr(e.path, 200),
      clampStr(e.slug, 200),
      clampStr(e.query, 100),
      clampStr(e.filter_type, 24),
      clampStr(e.filter_value, 80),
      Number.isFinite(e.result_count) ? (e.result_count | 0) : null,
      (channel && CONTACT_CHANNELS.has(channel)) ? channel : null,
      (e.lang === 'en' ? 'en' : 'sq'),
      e.app ? 1 : 0,
      device, browser, os, country,
      refHost(e.ref),
      vday,
    ));
    accepted++;
  }
  if (!accepted) return json({ ok: false, error: 'no_valid_events' }, { status: 400, request, env });
  await env.DB.batch(stmts);
  return json({ ok: true, accepted }, { request, env });
}

/** Resolve ?since=&until= (ms epoch), default last 30 days. */
function window30(url) {
  const now = Date.now();
  const since = toIntOrNull(url.searchParams.get('since')) ?? (now - 30 * 86400000);
  const until = toIntOrNull(url.searchParams.get('until')) ?? now;
  return { since, until };
}

/**
 * GET /api/admin/metrics/overview?since=&until=
 * Returns headline totals + leaderboards + splits + a daily timeseries.
 */
export async function handleMetricsOverview(request, env, url) {
  if (!env.DB) return json({ ok: false, error: 'db_unavailable' }, { status: 503, request, env });
  const { since, until } = window30(url);
  const B = (sql, ...binds) => env.DB.prepare(sql).bind(...binds);

  const [
    totals, daily, topBiz, topSearch, zeroSearch,
    contactClicks, devices, browsers, countries, topCats, appSplit,
  ] = await Promise.all([
    B(`SELECT
         COUNT(*) AS events,
         SUM(CASE WHEN type='page_view' THEN 1 ELSE 0 END) AS page_views,
         SUM(CASE WHEN type='business_view' THEN 1 ELSE 0 END) AS business_views,
         SUM(CASE WHEN type='search' THEN 1 ELSE 0 END) AS searches,
         SUM(CASE WHEN type='contact_click' THEN 1 ELSE 0 END) AS contact_clicks,
         SUM(CASE WHEN type='submit_success' THEN 1 ELSE 0 END) AS submissions,
         COUNT(DISTINCT visitor_day) AS visitors
       FROM events WHERE ts BETWEEN ?1 AND ?2`, since, until).first(),

    B(`SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day,
              COUNT(*) AS events, COUNT(DISTINCT visitor_day) AS visitors
       FROM events WHERE ts BETWEEN ?1 AND ?2 GROUP BY day ORDER BY day ASC`, since, until).all(),

    B(`SELECT slug, COUNT(*) AS views FROM events
       WHERE type='business_view' AND ts BETWEEN ?1 AND ?2 AND slug IS NOT NULL
       GROUP BY slug ORDER BY views DESC LIMIT 15`, since, until).all(),

    B(`SELECT query, COUNT(*) AS n FROM events
       WHERE type='search' AND ts BETWEEN ?1 AND ?2 AND query IS NOT NULL AND query<>''
       GROUP BY query ORDER BY n DESC LIMIT 15`, since, until).all(),

    B(`SELECT query, COUNT(*) AS n FROM events
       WHERE type='search' AND ts BETWEEN ?1 AND ?2 AND query IS NOT NULL AND query<>'' AND result_count=0
       GROUP BY query ORDER BY n DESC LIMIT 15`, since, until).all(),

    B(`SELECT channel, COUNT(*) AS n FROM events
       WHERE type='contact_click' AND ts BETWEEN ?1 AND ?2 AND channel IS NOT NULL
       GROUP BY channel ORDER BY n DESC`, since, until).all(),

    B(`SELECT COALESCE(device_class,'?') AS k, COUNT(*) AS n FROM events
       WHERE ts BETWEEN ?1 AND ?2 GROUP BY k ORDER BY n DESC`, since, until).all(),

    B(`SELECT COALESCE(browser,'?') AS k, COUNT(*) AS n FROM events
       WHERE ts BETWEEN ?1 AND ?2 GROUP BY k ORDER BY n DESC`, since, until).all(),

    B(`SELECT COALESCE(country,'?') AS k, COUNT(*) AS n FROM events
       WHERE ts BETWEEN ?1 AND ?2 GROUP BY k ORDER BY n DESC LIMIT 12`, since, until).all(),

    B(`SELECT filter_value AS slug, COUNT(*) AS n FROM events
       WHERE type='filter' AND filter_type='category' AND ts BETWEEN ?1 AND ?2 AND filter_value IS NOT NULL
       GROUP BY filter_value ORDER BY n DESC LIMIT 15`, since, until).all(),

    B(`SELECT app_flag AS k, COUNT(DISTINCT visitor_day) AS visitors, COUNT(*) AS events FROM events
       WHERE ts BETWEEN ?1 AND ?2 GROUP BY app_flag`, since, until).all(),
  ]);

  // Resolve business slugs -> names for the leaderboard.
  let topBusinesses = topBiz.results || [];
  if (topBusinesses.length) {
    const slugs = topBusinesses.map((r) => r.slug);
    const ph = slugs.map(() => '?').join(',');
    const names = await env.DB.prepare(
      `SELECT slug, name FROM businesses WHERE slug IN (${ph})`
    ).bind(...slugs).all();
    const nameMap = new Map((names.results || []).map((r) => [r.slug, r.name]));
    topBusinesses = topBusinesses.map((r) => ({ ...r, name: nameMap.get(r.slug) || r.slug }));
  }

  return json({
    ok: true, since, until,
    totals: totals || {},
    daily: daily.results || [],
    top_businesses: topBusinesses,
    top_searches: topSearch.results || [],
    zero_result_searches: zeroSearch.results || [],
    contact_clicks: contactClicks.results || [],
    devices: devices.results || [],
    browsers: browsers.results || [],
    countries: countries.results || [],
    top_categories: topCats.results || [],
    app_split: appSplit.results || [],
  }, { request, env });
}
