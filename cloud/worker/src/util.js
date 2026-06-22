/**
 * AlbaBiz.ie — shared helpers (responses, CORS, validation, slugify).
 * Mirrors the json()/text()/validator style from the zonetech-tv Worker.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

/**
 * Build the CORS header set for a request. We echo back the Origin if it is in
 * the configured allow-list (ALLOWED_ORIGINS), else fall back to the first
 * allowed origin. Credentials are allowed so the Cloudflare Access cookie can
 * ride along on admin calls from the browser.
 */
export function corsHeaders(request, env) {
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const allow = allowed.includes(origin) ? origin : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function json(body, { status = 200, headers = {}, request, env } = {}) {
  const cors = request ? corsHeaders(request, env) : {};
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...cors, ...headers },
  });
}

export function text(body, { status = 200, headers = {}, request, env } = {}) {
  const cors = request ? corsHeaders(request, env) : {};
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors, ...headers },
  });
}

export const now = () => Date.now();

// ---- Validators -----------------------------------------------------------

export function nonEmptyStr(v, max = 2000) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

export function clampStr(v, max = 2000) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

export function toIntOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

/**
 * URL-safe slug from a business name. Lowercases, strips diacritics (so Albanian
 * ë/ç collapse to e/c), removes non-alphanumerics, collapses dashes. Falls back
 * to 'biznes' if nothing survives.
 */
export function slugify(name) {
  const base = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return base || 'biznes';
}

/** A short random suffix for slug de-duplication / object keys. */
export function randToken(len = 6) {
  const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
