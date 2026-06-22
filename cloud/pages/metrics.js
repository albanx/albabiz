/*
 * AlbaBiz.ie — client metrics (anonymous, cookieless).
 * Buffers events and flushes them to POST /api/events via sendBeacon (so it
 * never blocks UX and survives page-close). No cookies, no localStorage id —
 * the server derives a rotating daily visitor hash. Exposes window.albabizTrack.
 *
 * App-vs-web: the Android shell appends ?app=1 (or sets window.ALBABIZ_APP),
 * which we forward so you can compare app vs browser usage.
 */
(function () {
  'use strict';
  var CFG = window.ALBABIZ_CONFIG || {};
  var API = (CFG.API_BASE || '').replace(/\/$/, '');
  var APP = (function () {
    try {
      if (window.ALBABIZ_APP) return 1;
      return /[?&]app=1\b/.test(location.search) ? 1 : 0;
    } catch (e) { return 0; }
  })();

  var buf = [];
  var timer = null;
  var FLUSH_MS = 4000;
  var MAX_BUF = 20;

  function lang() { try { return window.I18N ? window.I18N.lang : 'sq'; } catch (e) { return 'sq'; } }

  function flush(useBeacon) {
    if (!buf.length || !API) return;
    var batch = buf.splice(0, buf.length);
    var payload = JSON.stringify({ events: batch });
    try {
      if (useBeacon && navigator.sendBeacon) {
        // Blob with type so the Worker parses JSON. sendBeacon survives unload.
        navigator.sendBeacon(API + '/api/events', new Blob([payload], { type: 'application/json' }));
        return;
      }
    } catch (e) { /* fall through to fetch */ }
    try {
      fetch(API + '/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: payload, keepalive: true,
      }).catch(function () {});
    } catch (e) { /* swallow — metrics must never break the app */ }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; flush(false); }, FLUSH_MS);
  }

  /**
   * albabizTrack(type, props)
   *   type: page_view|search|filter|view_toggle|business_view|contact_click|
   *         outbound|submit_start|submit_success
   *   props: { path, slug, query, filter_type, filter_value, result_count, channel, ref }
   */
  function track(type, props) {
    if (!type) return;
    var e = props ? Object.assign({}, props) : {};
    e.type = type;
    e.lang = lang();
    e.app = APP;
    if (!('ref' in e)) { try { e.ref = document.referrer || ''; } catch (x) {} }
    // truncate query defensively
    if (e.query && e.query.length > 100) e.query = e.query.slice(0, 100);
    buf.push(e);
    if (buf.length >= MAX_BUF) flush(false);
    else schedule();
  }

  // Flush on tab hide / page unload (covers the common close-after-browsing case).
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', function () { flush(true); });

  window.albabizTrack = track;
})();
