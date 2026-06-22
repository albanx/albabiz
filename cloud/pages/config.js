/*
 * AlbaBiz.ie — front-end runtime config.
 *
 * EDIT THIS ONE LINE after you deploy the Worker: set API_BASE to your Worker's
 * URL (printed by `wrangler deploy`), e.g.
 *   https://albabiz-api.YOURNAME.workers.dev
 *
 * The Android WebView loads the same Pages site, so this value is what the app
 * talks to as well. (The app can ALSO override its WebView URL via the Worker's
 * /api/config, but the API base is read from here.)
 */
window.ALBABIZ_CONFIG = {
  API_BASE: 'https://albabiz-api.albanx.workers.dev',
  // Cloudflare Turnstile *site* key (public). Create a widget in the dashboard
  // and paste its site key here. The matching secret goes to the Worker via
  // `wrangler secret put TURNSTILE_SECRET`. The test key below always passes —
  // replace before launch.
  TURNSTILE_SITE_KEY: '0x4AAAAAADpGOZiuXBZUiBlN',
};
