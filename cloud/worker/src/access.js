/**
 * AlbaBiz.ie — Cloudflare Access verification for admin routes.
 *
 * This replaces the zonetech-tv "paste a bearer token" admin gate with proper
 * Zero Trust auth. Cloudflare Access sits in front of BOTH the /admin Pages
 * area AND the /api/admin/* Worker routes. When a request reaches the Worker,
 * Access has already authenticated the user (Google / email OTP) and injected
 * a signed JWT in the `Cf-Access-Jwt-Assertion` header (also a CF_Authorization
 * cookie). We verify that JWT here so the Worker NEVER trusts an unauthenticated
 * caller, even if someone bypasses the edge.
 *
 * Verification steps (RS256):
 *   1. Fetch the team's public keys from
 *      https://<team-domain>/cdn-cgi/access/certs  (cached in-memory per isolate)
 *   2. Match the token's `kid`, import the JWK, verify the RS256 signature.
 *   3. Check aud == ACCESS_AUD, iss == https://<team-domain>, exp not passed.
 *   4. Return { ok, email } — email is used for audit_log.actor.
 *
 * Dev escape hatch: if env.DEV_ADMIN_BYPASS is set (only ever in .dev.vars),
 * we short-circuit to dev@localhost so the admin panel can be built without
 * standing up Access. There is ALSO an optional ADMIN_BREAKGLASS bearer secret
 * for scripted/automation access outside a browser.
 */

// In-memory JWKS cache, scoped to the isolate. Keyed by team domain.
const jwksCache = new Map(); // teamDomain -> { keys: Map<kid, CryptoKey>, fetchedAt }
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h

function b64urlToUint8(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4), '='
  );
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtPart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToUint8(part)));
}

async function loadKeys(teamDomain) {
  const cached = jwksCache.get(teamDomain);
  if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;

  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  const resp = await fetch(url, { cf: { cacheTtl: 3600 } });
  if (!resp.ok) throw new Error(`jwks fetch ${resp.status}`);
  const data = await resp.json();
  const keys = new Map();
  for (const jwk of data.keys || []) {
    try {
      const key = await crypto.subtle.importKey(
        'jwk', jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['verify']
      );
      keys.set(jwk.kid, key);
    } catch {
      // skip malformed key
    }
  }
  jwksCache.set(teamDomain, { keys, fetchedAt: Date.now() });
  return keys;
}

/**
 * Verify the Access JWT on a request. Returns:
 *   { ok: true,  email }              — verified
 *   { ok: false, status, error }      — rejected (caller returns 401/403/503)
 */
export async function verifyAccess(request, env) {
  // --- Dev / break-glass paths (never both in production) ---
  if (env.DEV_ADMIN_BYPASS) {
    return { ok: true, email: 'dev@localhost', via: 'dev-bypass' };
  }

  const hasBreakglass = !!env.ADMIN_BREAKGLASS;
  const hasAccess = !!(env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD);

  if (hasBreakglass) {
    const h = request.headers.get('Authorization') || '';
    if (h === `Bearer ${env.ADMIN_BREAKGLASS}`) {
      return { ok: true, email: 'breakglass@albabiz', via: 'breakglass' };
    }
  }

  if (!hasAccess) {
    // Cloudflare Access isn't configured. If break-glass IS the active auth
    // mode, a missing/incorrect token is a normal 401 (the client shows the
    // sign-in gate) — NOT a 503. Only report "not configured" when there is
    // genuinely no auth method at all.
    if (hasBreakglass) {
      return { ok: false, status: 401, error: 'unauthorized' };
    }
    return { ok: false, status: 503, error: 'access_not_configured' };
  }

  // Access passes the JWT in this header; the CF_Authorization cookie carries
  // the same token for direct browser navigations.
  let token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    const cookie = request.headers.get('Cookie') || '';
    const m = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
    if (m) token = m[1];
  }
  if (!token) return { ok: false, status: 401, error: 'no_access_token' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, status: 401, error: 'malformed_token' };

  let header, payload;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    return { ok: false, status: 401, error: 'undecodable_token' };
  }

  // Signature
  let keys;
  try {
    keys = await loadKeys(env.ACCESS_TEAM_DOMAIN);
  } catch {
    return { ok: false, status: 503, error: 'jwks_unavailable' };
  }
  const key = keys.get(header.kid);
  if (!key) return { ok: false, status: 401, error: 'unknown_kid' };

  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const sig = b64urlToUint8(parts[2]);
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' }, key, sig, signed
  );
  if (!valid) return { ok: false, status: 401, error: 'bad_signature' };

  // Claims
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) {
    return { ok: false, status: 403, error: 'aud_mismatch' };
  }
  const expectedIss = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (payload.iss !== expectedIss) {
    return { ok: false, status: 403, error: 'iss_mismatch' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < nowSec) {
    return { ok: false, status: 401, error: 'token_expired' };
  }

  return { ok: true, email: payload.email || payload.sub || 'unknown', via: 'access' };
}
