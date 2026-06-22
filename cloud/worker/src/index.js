/**
 * AlbaBiz.ie — Cloudflare Worker API
 * Albanian Business Network Ireland · a project of the Albanian Cultural
 * Association Ireland (ACAI).
 *
 * Stack: Worker (this) + D1 (DB) + R2 (LOGOS) + Turnstile (spam) + Cloudflare
 * Access (admin auth). No separate backend server.
 *
 * PUBLIC routes (no auth):
 *   GET  /healthz
 *   GET  /api/config                       remote app config (WebView override etc.)
 *   GET  /api/businesses?county=&category=&q=&featured=&page=&pageSize=
 *   GET  /api/businesses/:slug
 *   GET  /api/categories
 *   GET  /api/counties
 *   POST /api/submit                       Turnstile + honeypot; multipart w/ logo -> R2; status='pending'
 *   POST /api/removal-request              GDPR self-service removal intake
 *   GET  /img/:key                         R2 logo proxy
 *
 * ADMIN routes (behind Cloudflare Access; Worker verifies the JWT):
 *   GET  /api/admin/pending
 *   GET  /api/admin/businesses?status=
 *   POST /api/admin/approve                { id }
 *   POST /api/admin/reject                 { id, reason? }
 *   PUT  /api/admin/business/:id           full edit (incl. category ids, lat/lng)
 *   POST /api/admin/feature                { id, featured: bool, until? }
 *   POST /api/admin/category               { slug,name_en,name_sq,icon? }
 *   PUT  /api/admin/category/:id           edit/deactivate
 *   POST /api/admin/county                 { slug,name_en,name_sq }
 *   PUT  /api/admin/county/:id
 *   GET  /api/admin/removals
 *   POST /api/admin/removal/:id/process    { action: 'processed'|'rejected' }
 *   GET  /api/admin/export.csv
 *
 * Secrets: TURNSTILE_SECRET, (optional) ADMIN_BREAKGLASS.
 * Vars:    ACCESS_TEAM_DOMAIN, ACCESS_AUD, ALLOWED_ORIGINS, APP_NAME.
 */

import {
  json, text, corsHeaders, now, nonEmptyStr, clampStr, isEmail,
  toIntOrNull, clampInt, slugify, randToken,
} from './util.js';
import { verifyAccess } from './access.js';
import { handleEvents, handleMetricsOverview } from './metrics.js';

// ===========================================================================
// Public helpers
// ===========================================================================

/** Verify a Turnstile token server-side. Skipped locally via DEV_SKIP_TURNSTILE. */
async function verifyTurnstile(token, ip, env) {
  if (env.DEV_SKIP_TURNSTILE) return true;
  if (!env.TURNSTILE_SECRET) return false; // fail closed if misconfigured in prod
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: form,
  });
  const data = await resp.json().catch(() => ({}));
  return data.success === true;
}

/** Shape a businesses row for PUBLIC output, honoring show_contact + status. */
function publicBusiness(row, categories) {
  const out = {
    slug: row.slug,
    name: row.name,
    description_sq: row.description_sq,
    description_en: row.description_en,
    county: row.county_slug ? { slug: row.county_slug, name_en: row.county_name_en, name_sq: row.county_name_sq } : null,
    town: row.town,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    website: row.website,
    facebook: row.facebook,
    instagram: row.instagram,
    linkedin: row.linkedin,
    logo: row.logo_key ? `/img/${row.logo_key}` : null,
    year_established: row.year_established,
    is_featured: !!row.is_featured,
    categories: categories || [],
  };
  // Contact fields only if the owner opted in.
  if (row.show_contact) {
    out.phone = row.phone || null;
    out.whatsapp = row.whatsapp || null;
    out.email = row.email || null;
  }
  // owner_name is NEVER exposed publicly.
  return out;
}

// ===========================================================================
// Public handlers
// ===========================================================================

async function handleConfig(request, env) {
  // Remote config the Android shell pulls on launch. Lets us repoint the
  // WebView or show a maintenance message without re-releasing the APK.
  return json({
    app_name: env.APP_NAME || 'AlbaBiz.ie',
    ui_base_override: null,   // set to a URL string to force the WebView elsewhere
    maintenance: false,
    message: null,
    min_version_code: 1,
    fetched_at: now(),
  }, { request, env, headers: { 'Cache-Control': 'public, max-age=120' } });
}

async function handleCounties(request, env) {
  // Counties with a count of approved businesses (for landing pages / filters).
  const rs = await env.DB.prepare(
    `SELECT c.slug, c.name_en, c.name_sq,
            (SELECT COUNT(*) FROM businesses b
              WHERE b.county_id = c.id AND b.status = 'approved') AS count
       FROM counties c ORDER BY c.sort_order ASC`
  ).all();
  return json({ ok: true, counties: rs.results || [] }, {
    request, env, headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

async function handleCategories(request, env) {
  const rs = await env.DB.prepare(
    `SELECT cat.slug, cat.name_en, cat.name_sq, cat.icon,
            (SELECT COUNT(*) FROM business_categories bc
               JOIN businesses b ON b.id = bc.business_id
              WHERE bc.category_id = cat.id AND b.status = 'approved') AS count
       FROM categories cat
      WHERE cat.is_active = 1
      ORDER BY cat.sort_order ASC`
  ).all();
  return json({ ok: true, categories: rs.results || [] }, {
    request, env, headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

/**
 * GET /api/businesses — public, paginated, filterable.
 * Filters: county (slug), category (slug), q (free text), featured (1).
 */
async function handleBusinessesList(request, env, url) {
  const page = clampInt(url.searchParams.get('page'), 1, 10000, 1);
  const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 50, 20);
  const offset = (page - 1) * pageSize;
  const county = clampStr(url.searchParams.get('county'), 64);
  const category = clampStr(url.searchParams.get('category'), 64);
  const q = clampStr(url.searchParams.get('q'), 100);
  const featuredOnly = url.searchParams.get('featured') === '1';

  const where = [`b.status = 'approved'`];
  const binds = [];
  if (county) { where.push(`co.slug = ?`); binds.push(county); }
  if (featuredOnly) { where.push(`b.is_featured = 1`); }
  if (q) {
    where.push(`(b.name LIKE ? OR b.description_sq LIKE ? OR b.description_en LIKE ? OR b.town LIKE ?)`);
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }
  // Category filter needs an EXISTS against the join table.
  if (category) {
    where.push(`EXISTS (SELECT 1 FROM business_categories bc
                          JOIN categories cat ON cat.id = bc.category_id
                         WHERE bc.business_id = b.id AND cat.slug = ?)`);
    binds.push(category);
  }
  const whereSql = where.join(' AND ');

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM businesses b
       LEFT JOIN counties co ON co.id = b.county_id
      WHERE ${whereSql}`
  ).bind(...binds).first();
  const total = countRow ? countRow.n : 0;

  const rs = await env.DB.prepare(
    `SELECT b.*, co.slug AS county_slug, co.name_en AS county_name_en, co.name_sq AS county_name_sq
       FROM businesses b
       LEFT JOIN counties co ON co.id = b.county_id
      WHERE ${whereSql}
      ORDER BY b.is_featured DESC, b.name ASC
      LIMIT ? OFFSET ?`
  ).bind(...binds, pageSize, offset).all();

  const rows = rs.results || [];
  const cats = await categoriesForBusinesses(env, rows.map((r) => r.id));
  const businesses = rows.map((r) => publicBusiness(r, cats.get(r.id) || []));

  return json({
    ok: true,
    businesses,
    page, pageSize, total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
  }, { request, env, headers: { 'Cache-Control': 'public, max-age=60' } });
}

/** Map of business_id -> [{slug,name_en,name_sq,icon}] for a set of ids. */
async function categoriesForBusinesses(env, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const placeholders = ids.map(() => '?').join(',');
  const rs = await env.DB.prepare(
    `SELECT bc.business_id, cat.slug, cat.name_en, cat.name_sq, cat.icon
       FROM business_categories bc
       JOIN categories cat ON cat.id = bc.category_id
      WHERE bc.business_id IN (${placeholders})
      ORDER BY cat.sort_order ASC`
  ).bind(...ids).all();
  for (const r of rs.results || []) {
    if (!map.has(r.business_id)) map.set(r.business_id, []);
    map.get(r.business_id).push({ slug: r.slug, name_en: r.name_en, name_sq: r.name_sq, icon: r.icon });
  }
  return map;
}

async function handleBusinessBySlug(request, env, slug) {
  const row = await env.DB.prepare(
    `SELECT b.*, co.slug AS county_slug, co.name_en AS county_name_en, co.name_sq AS county_name_sq
       FROM businesses b
       LEFT JOIN counties co ON co.id = b.county_id
      WHERE b.slug = ? AND b.status = 'approved'`
  ).bind(slug).first();
  if (!row) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  const cats = await categoriesForBusinesses(env, [row.id]);
  return json({ ok: true, business: publicBusiness(row, cats.get(row.id) || []) }, {
    request, env, headers: { 'Cache-Control': 'public, max-age=120' },
  });
}

/**
 * POST /api/submit — public business submission.
 * Accepts multipart/form-data (so the logo can ride along) OR application/json
 * (no logo). Anti-spam: Turnstile token + honeypot field `company_fax` (must be
 * empty). Writes status='pending'.
 */
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

async function handleSubmit(request, env) {
  const ct = request.headers.get('Content-Type') || '';
  let fields = {};
  let logoFile = null;
  let categoryIds = [];

  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    for (const [k, v] of form.entries()) {
      if (k === 'logo' && typeof v === 'object') { logoFile = v; continue; }
      if (k === 'categories') { // repeated field or comma list
        const vals = String(v).split(',').map((s) => toIntOrNull(s)).filter((n) => n !== null);
        categoryIds.push(...vals);
        continue;
      }
      fields[k] = v;
    }
  } else {
    fields = await request.json().catch(() => ({}));
    if (Array.isArray(fields.categories)) {
      categoryIds = fields.categories.map((n) => toIntOrNull(n)).filter((n) => n !== null);
    }
  }

  // Honeypot: real users never see/fill this. Pretend success to waste bots.
  if (clampStr(fields.company_fax, 200)) {
    return json({ ok: true, pending: true, id: null }, { status: 202, request, env });
  }

  // Turnstile
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ok = await verifyTurnstile(fields['cf-turnstile-response'] || fields.turnstile_token, ip, env);
  if (!ok) return json({ ok: false, error: 'turnstile_failed' }, { status: 403, request, env });

  // Required fields
  const name = clampStr(fields.name, 200);
  if (!name) return json({ ok: false, error: 'name_required' }, { status: 400, request, env });
  const gdpr = fields.gdpr_consent === 'true' || fields.gdpr_consent === true || fields.gdpr_consent === '1' || fields.gdpr_consent === 1;
  if (!gdpr) return json({ ok: false, error: 'gdpr_consent_required' }, { status: 400, request, env });

  // County resolution (by slug or id)
  let countyId = null;
  const countyRef = clampStr(fields.county, 64);
  if (countyRef) {
    const cr = await env.DB.prepare(
      `SELECT id FROM counties WHERE slug = ? OR id = ?`
    ).bind(countyRef, toIntOrNull(countyRef)).first();
    countyId = cr ? cr.id : null;
  }

  // Optional logo -> R2
  let logoKey = null;
  if (logoFile && typeof logoFile.arrayBuffer === 'function') {
    const type = logoFile.type || '';
    if (!LOGO_TYPES.has(type)) {
      return json({ ok: false, error: 'logo_type_unsupported' }, { status: 400, request, env });
    }
    const buf = await logoFile.arrayBuffer();
    if (buf.byteLength > LOGO_MAX_BYTES) {
      return json({ ok: false, error: 'logo_too_large', max_bytes: LOGO_MAX_BYTES }, { status: 413, request, env });
    }
    const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
    logoKey = `logos/${Date.now()}-${randToken(8)}.${ext}`;
    await env.LOGOS.put(logoKey, buf, { httpMetadata: { contentType: type } });
  }

  const ts = now();
  const result = await env.DB.prepare(
    `INSERT INTO businesses
      (status, name, owner_name, description_sq, description_en, county_id, town, address,
       phone, whatsapp, email, website, facebook, instagram, linkedin, logo_key,
       year_established, show_contact, gdpr_consent, gdpr_consent_at,
       submitted_ip, submitted_country, source, created_at, updated_at)
     VALUES ('pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'web', ?, ?)`
  ).bind(
    name,
    clampStr(fields.owner_name, 200),
    clampStr(fields.description_sq, 2000),
    clampStr(fields.description_en, 2000),
    countyId,
    clampStr(fields.town, 120),
    clampStr(fields.address, 300),
    clampStr(fields.phone, 40),
    clampStr(fields.whatsapp, 40),
    isEmail(fields.email) ? fields.email : null,
    clampStr(fields.website, 300),
    clampStr(fields.facebook, 300),
    clampStr(fields.instagram, 300),
    clampStr(fields.linkedin, 300),
    logoKey,
    toIntOrNull(fields.year_established),
    (fields.show_contact === 'false' || fields.show_contact === false || fields.show_contact === '0') ? 0 : 1,
    ts,
    ip || null,
    request.cf?.country || null,
    ts, ts,
  ).run();

  const newId = result.meta?.last_row_id;
  // Attach categories (validated against the table).
  if (newId && categoryIds.length) {
    const uniq = [...new Set(categoryIds)].slice(0, 10);
    for (const cid of uniq) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO business_categories (business_id, category_id)
           SELECT ?, id FROM categories WHERE id = ?`
      ).bind(newId, cid).run();
    }
  }

  return json({ ok: true, pending: true, id: newId }, { status: 201, request, env });
}

async function handleRemovalRequest(request, env) {
  const body = await request.json().catch(() => ({}));
  // honeypot
  if (clampStr(body.company_fax, 200)) {
    return json({ ok: true, received: true }, { status: 202, request, env });
  }
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ok = await verifyTurnstile(body['cf-turnstile-response'] || body.turnstile_token, ip, env);
  if (!ok) return json({ ok: false, error: 'turnstile_failed' }, { status: 403, request, env });

  if (!isEmail(body.email)) {
    return json({ ok: false, error: 'email_required' }, { status: 400, request, env });
  }
  // Try to match an existing business by slug for the admin's convenience.
  let businessId = null;
  const slug = clampStr(body.slug, 200);
  if (slug) {
    const r = await env.DB.prepare(`SELECT id FROM businesses WHERE slug = ?`).bind(slug).first();
    businessId = r ? r.id : null;
  }
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO removal_requests (business_id, business_name, email, reason, status, created_at)
     VALUES (?, ?, ?, ?, 'open', ?)`
  ).bind(
    businessId,
    clampStr(body.business_name, 200),
    body.email,
    clampStr(body.reason, 1000),
    ts,
  ).run();
  return json({ ok: true, received: true }, { status: 201, request, env });
}

async function handleImage(request, env, key) {
  const obj = await env.LOGOS.get(key);
  if (!obj) return new Response('not found', { status: 404, headers: corsHeaders(request, env) });
  const headers = new Headers(corsHeaders(request, env));
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  obj.writeHttpMetadata(headers);
  return new Response(obj.body, { headers });
}

// ===========================================================================
// Admin handlers (all gated by verifyAccess upstream)
// ===========================================================================

async function adminLog(env, businessId, action, actor, detail) {
  await env.DB.prepare(
    `INSERT INTO audit_log (business_id, action, actor, detail, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(businessId || null, action, actor || null, detail ? String(detail).slice(0, 500) : null, now()).run();
}

/** Full row (incl. private fields) for admin views. */
async function adminBusinessRow(env, id) {
  const row = await env.DB.prepare(
    `SELECT b.*, co.slug AS county_slug FROM businesses b
       LEFT JOIN counties co ON co.id = b.county_id WHERE b.id = ?`
  ).bind(id).first();
  if (!row) return null;
  const cats = await env.DB.prepare(
    `SELECT category_id FROM business_categories WHERE business_id = ?`
  ).bind(id).all();
  row.category_ids = (cats.results || []).map((r) => r.category_id);
  return row;
}

async function handleAdminBusinesses(request, env, url) {
  const status = clampStr(url.searchParams.get('status'), 20) || 'pending';
  const page = clampInt(url.searchParams.get('page'), 1, 10000, 1);
  const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 100, 50);
  const offset = (page - 1) * pageSize;
  const rs = await env.DB.prepare(
    `SELECT b.*, co.slug AS county_slug FROM businesses b
       LEFT JOIN counties co ON co.id = b.county_id
      WHERE b.status = ?
      ORDER BY b.created_at DESC LIMIT ? OFFSET ?`
  ).bind(status, pageSize, offset).all();
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM businesses WHERE status = ?`
  ).bind(status).first();
  return json({ ok: true, businesses: rs.results || [], total: countRow?.n || 0, page, pageSize }, { request, env });
}

/** Generate a unique slug, suffixing -2, -3... on collision. */
async function uniqueSlug(env, name) {
  const base = slugify(name);
  let candidate = base;
  for (let i = 2; i < 200; i++) {
    const hit = await env.DB.prepare(`SELECT 1 FROM businesses WHERE slug = ?`).bind(candidate).first();
    if (!hit) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${randToken(5)}`;
}

async function handleAdminApprove(request, env, actor) {
  const body = await request.json().catch(() => ({}));
  const id = toIntOrNull(body.id);
  if (!id) return json({ ok: false, error: 'id_required' }, { status: 400, request, env });
  const row = await env.DB.prepare(`SELECT id, name, slug, status FROM businesses WHERE id = ?`).bind(id).first();
  if (!row) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  const slug = row.slug || await uniqueSlug(env, row.name);
  const ts = now();
  await env.DB.prepare(
    `UPDATE businesses SET status='approved', slug=?, approved_at=?, approved_by=?, updated_at=? WHERE id=?`
  ).bind(slug, ts, actor, ts, id).run();
  await adminLog(env, id, 'approve', actor, slug);
  return json({ ok: true, id, slug }, { request, env });
}

async function handleAdminReject(request, env, actor) {
  const body = await request.json().catch(() => ({}));
  const id = toIntOrNull(body.id);
  if (!id) return json({ ok: false, error: 'id_required' }, { status: 400, request, env });
  const ts = now();
  const res = await env.DB.prepare(
    `UPDATE businesses SET status='rejected', updated_at=? WHERE id=?`
  ).bind(ts, id).run();
  if (!res.meta?.changes) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  await adminLog(env, id, 'reject', actor, clampStr(body.reason, 500));
  return json({ ok: true, id }, { request, env });
}

async function handleAdminBusinessPut(request, env, id, actor) {
  const body = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare(`SELECT id FROM businesses WHERE id = ?`).bind(id).first();
  if (!existing) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });

  // Build a dynamic update over an allow-list of editable columns.
  const cols = {
    name: clampStr(body.name, 200),
    owner_name: clampStr(body.owner_name, 200),
    description_sq: clampStr(body.description_sq, 2000),
    description_en: clampStr(body.description_en, 2000),
    town: clampStr(body.town, 120),
    address: clampStr(body.address, 300),
    lat: (typeof body.lat === 'number') ? body.lat : null,
    lng: (typeof body.lng === 'number') ? body.lng : null,
    phone: clampStr(body.phone, 40),
    whatsapp: clampStr(body.whatsapp, 40),
    email: isEmail(body.email) ? body.email : null,
    website: clampStr(body.website, 300),
    facebook: clampStr(body.facebook, 300),
    instagram: clampStr(body.instagram, 300),
    linkedin: clampStr(body.linkedin, 300),
    year_established: toIntOrNull(body.year_established),
    show_contact: (body.show_contact === false || body.show_contact === 0 || body.show_contact === '0') ? 0 : 1,
  };
  // County by slug/id if provided.
  if (body.county !== undefined) {
    const cr = await env.DB.prepare(`SELECT id FROM counties WHERE slug = ? OR id = ?`)
      .bind(clampStr(body.county, 64), toIntOrNull(body.county)).first();
    cols.county_id = cr ? cr.id : null;
  }
  const setSql = Object.keys(cols).map((k) => `${k}=?`).join(', ');
  const binds = Object.values(cols);
  await env.DB.prepare(`UPDATE businesses SET ${setSql}, updated_at=? WHERE id=?`)
    .bind(...binds, now(), id).run();

  // Replace category set if provided.
  if (Array.isArray(body.category_ids)) {
    await env.DB.prepare(`DELETE FROM business_categories WHERE business_id = ?`).bind(id).run();
    const uniq = [...new Set(body.category_ids.map((n) => toIntOrNull(n)).filter((n) => n !== null))].slice(0, 10);
    for (const cid of uniq) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO business_categories (business_id, category_id)
           SELECT ?, id FROM categories WHERE id = ?`
      ).bind(id, cid).run();
    }
  }
  await adminLog(env, id, 'edit', actor, null);
  const fresh = await adminBusinessRow(env, id);
  return json({ ok: true, business: fresh }, { request, env });
}

async function handleAdminFeature(request, env, actor) {
  const body = await request.json().catch(() => ({}));
  const id = toIntOrNull(body.id);
  if (!id) return json({ ok: false, error: 'id_required' }, { status: 400, request, env });
  const featured = body.featured ? 1 : 0;
  const until = toIntOrNull(body.until);
  const res = await env.DB.prepare(
    `UPDATE businesses SET is_featured=?, featured_until=?, updated_at=? WHERE id=?`
  ).bind(featured, until, now(), id).run();
  if (!res.meta?.changes) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  await adminLog(env, id, featured ? 'feature' : 'unfeature', actor, null);
  return json({ ok: true, id, featured: !!featured }, { request, env });
}

async function handleAdminRemoveBusiness(request, env, id, actor) {
  // Soft-delete: status='removed' so it disappears from public but stays for audit.
  const res = await env.DB.prepare(
    `UPDATE businesses SET status='removed', updated_at=? WHERE id=?`
  ).bind(now(), id).run();
  if (!res.meta?.changes) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  await adminLog(env, id, 'remove', actor, null);
  return json({ ok: true, id }, { request, env });
}

// ---- Category / county management ----------------------------------------

async function handleAdminCategoryCreate(request, env, actor) {
  const b = await request.json().catch(() => ({}));
  if (!nonEmptyStr(b.name_en) || !nonEmptyStr(b.name_sq)) {
    return json({ ok: false, error: 'names_required' }, { status: 400, request, env });
  }
  const slug = slugify(b.slug || b.name_en);
  await env.DB.prepare(
    `INSERT INTO categories (slug, name_en, name_sq, icon, sort_order, is_active)
     VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order)+1 FROM categories), 1), 1)`
  ).bind(slug, clampStr(b.name_en, 80), clampStr(b.name_sq, 80), clampStr(b.icon, 16)).run();
  await adminLog(env, null, 'category_create', actor, slug);
  return json({ ok: true, slug }, { status: 201, request, env });
}

async function handleAdminCategoryPut(request, env, id, actor) {
  const b = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare(`SELECT id FROM categories WHERE id=?`).bind(id).first();
  if (!existing) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  await env.DB.prepare(
    `UPDATE categories SET
       name_en = COALESCE(?, name_en),
       name_sq = COALESCE(?, name_sq),
       icon    = COALESCE(?, icon),
       is_active = COALESCE(?, is_active)
     WHERE id = ?`
  ).bind(
    clampStr(b.name_en, 80), clampStr(b.name_sq, 80), clampStr(b.icon, 16),
    (b.is_active === undefined ? null : (b.is_active ? 1 : 0)), id
  ).run();
  await adminLog(env, null, 'category_edit', actor, String(id));
  return json({ ok: true, id }, { request, env });
}

async function handleAdminCountyCreate(request, env, actor) {
  const b = await request.json().catch(() => ({}));
  if (!nonEmptyStr(b.name_en) || !nonEmptyStr(b.name_sq)) {
    return json({ ok: false, error: 'names_required' }, { status: 400, request, env });
  }
  const slug = slugify(b.slug || b.name_en);
  await env.DB.prepare(
    `INSERT INTO counties (slug, name_en, name_sq, sort_order)
     VALUES (?, ?, ?, COALESCE((SELECT MAX(sort_order)+1 FROM counties), 1))`
  ).bind(slug, clampStr(b.name_en, 80), clampStr(b.name_sq, 80)).run();
  await adminLog(env, null, 'county_create', actor, slug);
  return json({ ok: true, slug }, { status: 201, request, env });
}

async function handleAdminCountyPut(request, env, id, actor) {
  const b = await request.json().catch(() => ({}));
  const existing = await env.DB.prepare(`SELECT id FROM counties WHERE id=?`).bind(id).first();
  if (!existing) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  await env.DB.prepare(
    `UPDATE counties SET name_en = COALESCE(?, name_en), name_sq = COALESCE(?, name_sq) WHERE id = ?`
  ).bind(clampStr(b.name_en, 80), clampStr(b.name_sq, 80), id).run();
  await adminLog(env, null, 'county_edit', actor, String(id));
  return json({ ok: true, id }, { request, env });
}

// ---- Removal requests ------------------------------------------------------

async function handleAdminRemovals(request, env) {
  const rs = await env.DB.prepare(
    `SELECT * FROM removal_requests ORDER BY (status='open') DESC, created_at DESC LIMIT 200`
  ).all();
  return json({ ok: true, removals: rs.results || [] }, { request, env });
}

async function handleAdminRemovalProcess(request, env, id, actor) {
  const b = await request.json().catch(() => ({}));
  const action = (b.action === 'rejected') ? 'rejected' : 'processed';
  const res = await env.DB.prepare(
    `UPDATE removal_requests SET status=?, processed_at=?, processed_by=? WHERE id=?`
  ).bind(action, now(), actor, id).run();
  if (!res.meta?.changes) return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  // If processing (not rejecting) and tied to a business, soft-remove it too.
  if (action === 'processed') {
    const rr = await env.DB.prepare(`SELECT business_id FROM removal_requests WHERE id=?`).bind(id).first();
    if (rr?.business_id) {
      await env.DB.prepare(`UPDATE businesses SET status='removed', updated_at=? WHERE id=?`)
        .bind(now(), rr.business_id).run();
      await adminLog(env, rr.business_id, 'removal_process', actor, String(id));
    }
  }
  return json({ ok: true, id, status: action }, { request, env });
}

// ---- CSV export ------------------------------------------------------------

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function handleAdminExportCsv(request, env) {
  const rs = await env.DB.prepare(
    `SELECT b.id, b.slug, b.status, b.name, b.owner_name, b.description_en, b.description_sq,
            co.name_en AS county, b.town, b.address, b.lat, b.lng,
            b.phone, b.whatsapp, b.email, b.website, b.facebook, b.instagram, b.linkedin,
            b.year_established, b.show_contact, b.is_featured, b.gdpr_consent, b.gdpr_consent_at,
            b.source, b.created_at, b.approved_at, b.approved_by
       FROM businesses b LEFT JOIN counties co ON co.id = b.county_id
      ORDER BY b.created_at DESC`
  ).all();
  const rows = rs.results || [];
  const headers = [
    'id','slug','status','name','owner_name','description_en','description_sq','county','town',
    'address','lat','lng','phone','whatsapp','email','website','facebook','instagram','linkedin',
    'year_established','show_contact','is_featured','gdpr_consent','gdpr_consent_at','source',
    'created_at','approved_at','approved_by',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  const cors = corsHeaders(request, env);
  return new Response(lines.join('\n'), {
    headers: {
      ...cors,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="albabiz-export-${Date.now()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ===========================================================================
// Router
// ===========================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (pathname === '/healthz' || pathname === '/') {
      return text('ok', { request, env });
    }

    try {
      // ---- Public GET ----
      if (pathname === '/api/config' && method === 'GET') return await handleConfig(request, env);
      if (pathname === '/api/counties' && method === 'GET') return await handleCounties(request, env);
      if (pathname === '/api/categories' && method === 'GET') return await handleCategories(request, env);
      if (pathname === '/api/businesses' && method === 'GET') return await handleBusinessesList(request, env, url);

      let m;
      if ((m = pathname.match(/^\/api\/businesses\/([a-z0-9-]+)$/)) && method === 'GET') {
        return await handleBusinessBySlug(request, env, m[1]);
      }
      if ((m = pathname.match(/^\/img\/(.+)$/)) && method === 'GET') {
        return await handleImage(request, env, m[1]);
      }

      // ---- Public POST ----
      if (pathname === '/api/submit' && method === 'POST') return await handleSubmit(request, env);
      if (pathname === '/api/removal-request' && method === 'POST') return await handleRemovalRequest(request, env);
      if (pathname === '/api/events' && method === 'POST') return await handleEvents(request, env);

      // ---- Admin (Access-gated) ----
      if (pathname.startsWith('/api/admin/')) {
        const auth = await verifyAccess(request, env);
        if (!auth.ok) {
          return json({ ok: false, error: auth.error || 'unauthorized' }, { status: auth.status || 401, request, env });
        }
        const actor = auth.email;

        if (pathname === '/api/admin/pending' && method === 'GET') {
          url.searchParams.set('status', 'pending');
          return await handleAdminBusinesses(request, env, url);
        }
        if (pathname === '/api/admin/businesses' && method === 'GET') return await handleAdminBusinesses(request, env, url);
        if (pathname === '/api/admin/approve' && method === 'POST') return await handleAdminApprove(request, env, actor);
        if (pathname === '/api/admin/reject' && method === 'POST') return await handleAdminReject(request, env, actor);
        if (pathname === '/api/admin/feature' && method === 'POST') return await handleAdminFeature(request, env, actor);
        if (pathname === '/api/admin/removals' && method === 'GET') return await handleAdminRemovals(request, env);
        if (pathname === '/api/admin/metrics/overview' && method === 'GET') return await handleMetricsOverview(request, env, url);
        if (pathname === '/api/admin/export.csv' && method === 'GET') return await handleAdminExportCsv(request, env);
        if (pathname === '/api/admin/category' && method === 'POST') return await handleAdminCategoryCreate(request, env, actor);
        if (pathname === '/api/admin/county' && method === 'POST') return await handleAdminCountyCreate(request, env, actor);

        if ((m = pathname.match(/^\/api\/admin\/business\/(\d+)$/)) && method === 'PUT') {
          return await handleAdminBusinessPut(request, env, toIntOrNull(m[1]), actor);
        }
        if ((m = pathname.match(/^\/api\/admin\/business\/(\d+)$/)) && method === 'DELETE') {
          return await handleAdminRemoveBusiness(request, env, toIntOrNull(m[1]), actor);
        }
        if ((m = pathname.match(/^\/api\/admin\/category\/(\d+)$/)) && method === 'PUT') {
          return await handleAdminCategoryPut(request, env, toIntOrNull(m[1]), actor);
        }
        if ((m = pathname.match(/^\/api\/admin\/county\/(\d+)$/)) && method === 'PUT') {
          return await handleAdminCountyPut(request, env, toIntOrNull(m[1]), actor);
        }
        if ((m = pathname.match(/^\/api\/admin\/removal\/(\d+)\/process$/)) && method === 'POST') {
          return await handleAdminRemovalProcess(request, env, toIntOrNull(m[1]), actor);
        }
        return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
      }
    } catch (err) {
      console.error('worker error', err && (err.stack || err.message || err));
      return json({ ok: false, error: 'internal' }, { status: 500, request, env });
    }

    return json({ ok: false, error: 'not_found' }, { status: 404, request, env });
  },
};
