/*
 * AlbaBiz admin SPA — vanilla JS, no build step.
 *
 * AUTH (two supported modes, auto-detected):
 *  1. Cloudflare Access (preferred, custom-domain setup): the browser already
 *     holds the CF_Authorization cookie for the zone, so we call the API with
 *     credentials:'include' and the Worker verifies the Access JWT. No token UI.
 *  2. Break-glass token (free *.workers.dev setup, where Access can't sit in
 *     front of the Worker): we send Authorization: Bearer <ADMIN_BREAKGLASS>.
 *     The token lives in sessionStorage only.
 *
 * On boot we probe GET /api/admin/pending. 200 -> we're in (mode 1 or dev
 * bypass). 401/403 -> show the token gate (mode 2).
 */
(function () {
  'use strict';
  var CFG = window.ALBABIZ_CONFIG || {};
  var API = (CFG.API_BASE || '').replace(/\/$/, '');
  var TOKEN_KEY = 'albabiz.admin.token';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null) return; n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }

  function authHeaders(extra) {
    var h = extra || {};
    var t = token();
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  async function api(path, init) {
    init = init || {};
    init.credentials = 'include'; // carry the Access cookie when present
    init.headers = authHeaders(init.headers || {});
    var resp = await fetch(API + path, init);
    var txt = await resp.text();
    var body = null; try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = { raw: txt }; }
    if (resp.status === 401 || resp.status === 403 || resp.status === 503) { showGate(); throw new Error(body && body.error || 'unauthorized'); }
    if (!resp.ok) throw new Error(body && body.error || ('http_' + resp.status));
    return body;
  }

  // ---- gate ---------------------------------------------------------------
  function showGate() {
    $('#app').hidden = true; $('#gate').hidden = false;
    $('#signout').hidden = true;
  }
  function showApp() {
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#signout').hidden = !token();
  }
  $('#gate-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#token').value.trim();
    if (!v) return;
    sessionStorage.setItem(TOKEN_KEY, v);
    boot();
  });
  $('#signout').addEventListener('click', function () {
    sessionStorage.removeItem(TOKEN_KEY); showGate();
  });

  // ---- tabs ---------------------------------------------------------------
  var TABS = { pending: tabPending, all: tabAll, metrics: tabMetrics, categories: tabCategories, counties: tabCounties, removals: tabRemovals, export: tabExport };
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (x) { x.setAttribute('aria-current', 'false'); });
      b.setAttribute('aria-current', 'true');
      TABS[b.getAttribute('data-tab')]();
    });
  });

  function body() { return $('#tab-body'); }
  function loading() { var b = body(); clear(b); b.appendChild(el('div', { class: 'spinner' })); }

  // ---- pending / all ------------------------------------------------------
  function bizCard(b, opts) {
    opts = opts || {};
    var thumb = b.logo_key
      ? el('div', { class: 'thumb' }, [el('img', { src: API + '/img/' + b.logo_key, alt: '' })])
      : el('div', { class: 'thumb', text: '🏬' });
    var actions = [];
    if (b.status === 'pending') {
      actions.push(el('button', { class: 'btn btn-sm btn-approve', text: '✓ Approve', onclick: function () { doApprove(b.id); } }));
      actions.push(el('button', { class: 'btn btn-sm btn-reject', text: '✕ Reject', onclick: function () { doReject(b.id); } }));
    }
    actions.push(el('button', { class: 'btn btn-sm btn-ghost', text: '✎ Edit', onclick: function () { openEdit(b.id); } }));
    if (b.status === 'approved') {
      actions.push(el('button', { class: 'btn btn-sm btn-ghost', text: b.is_featured ? '★ Unfeature' : '☆ Feature', onclick: function () { doFeature(b.id, !b.is_featured); } }));
      actions.push(el('a', { class: 'btn btn-sm btn-ghost', href: '/biznes/' + b.slug, target: '_blank', text: '↗ View' }));
    }
    if (b.status !== 'removed') {
      actions.push(el('button', { class: 'btn btn-sm btn-danger', text: '🗑 Remove', onclick: function () { doRemove(b.id); } }));
    }
    var meta = [b.county_slug, b.town].filter(Boolean).join(' · ');
    return el('div', { class: 'admin-card' }, [
      thumb,
      el('div', { class: 'grow' }, [
        el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
          el('h3', { text: b.name }),
          el('span', { class: 'status ' + b.status, text: b.status }),
          b.is_featured ? el('span', { class: 'badge-featured', text: 'Featured' }) : null,
        ]),
        meta ? el('div', { class: 'meta', text: meta }) : null,
        b.owner_name ? el('div', { class: 'meta', text: '👤 ' + b.owner_name + (b.email ? ' · ' + b.email : '') + (b.phone ? ' · ' + b.phone : '') }) : null,
        b.description_en || b.description_sq ? el('div', { class: 'meta', text: (b.description_en || b.description_sq || '').slice(0, 160) }) : null,
        el('div', { class: 'row-actions' }, actions),
      ]),
    ]);
  }

  async function tabPending() {
    loading();
    try {
      var d = await api('/api/admin/pending');
      var b = body(); clear(b);
      $('#pending-count').textContent = d.total || '';
      if (!(d.businesses || []).length) { b.appendChild(el('p', { class: 'state', text: 'No pending submissions 🎉' })); return; }
      d.businesses.forEach(function (x) { b.appendChild(bizCard(x)); });
    } catch (e) {}
  }

  async function tabAll() {
    loading();
    var b = body(); clear(b);
    var picker = el('div', { class: 'inline-form' }, [
      el('div', { class: 'form-row' }, [
        el('label', { text: 'Status' }),
        el('select', { id: 'status-filter', onchange: reloadAll }, ['approved', 'pending', 'rejected', 'removed'].map(function (s) {
          return el('option', { value: s, text: s });
        })),
      ]),
    ]);
    b.appendChild(picker);
    var list = el('div', { id: 'all-list' }, [el('div', { class: 'spinner' })]);
    b.appendChild(list);
    reloadAll();
    async function reloadAll() {
      var status = ($('#status-filter') || {}).value || 'approved';
      var l = $('#all-list'); clear(l); l.appendChild(el('div', { class: 'spinner' }));
      try {
        var d = await api('/api/admin/businesses?status=' + status + '&pageSize=100');
        clear(l);
        if (!(d.businesses || []).length) { l.appendChild(el('p', { class: 'state', text: 'Nothing here.' })); return; }
        d.businesses.forEach(function (x) { l.appendChild(bizCard(x)); });
      } catch (e) {}
    }
  }

  async function doApprove(id) { try { await api('/api/admin/approve', mkPost({ id: id })); refresh(); } catch (e) { alert('Approve failed: ' + e.message); } }
  async function doReject(id) { if (!confirm('Reject this submission?')) return; try { await api('/api/admin/reject', mkPost({ id: id })); refresh(); } catch (e) { alert(e.message); } }
  async function doFeature(id, on) { try { await api('/api/admin/feature', mkPost({ id: id, featured: on })); refresh(); } catch (e) { alert(e.message); } }
  async function doRemove(id) { if (!confirm('Soft-remove this business from the directory?')) return; try { await api('/api/admin/business/' + id, { method: 'DELETE' }); refresh(); } catch (e) { alert(e.message); } }
  function mkPost(obj) { return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) }; }
  function refresh() {
    var cur = document.querySelector('.tab-btn[aria-current="true"]');
    TABS[cur ? cur.getAttribute('data-tab') : 'pending']();
  }

  // ---- edit modal ---------------------------------------------------------
  async function openEdit(id) {
    var results = await Promise.all([
      api('/api/categories'), api('/api/counties'), fetchAdminBusiness(id),
    ]);
    var cats = results[0], counties = results[1], rec = results[2];
    if (!rec) { alert('Could not load record.'); return; }
    var m = $('#modal'); var mb = $('#modal-body'); clear(mb);
    $('#modal-title').textContent = 'Edit · ' + rec.name;

    function input(name, label, val, type) {
      return el('div', { class: 'form-row' }, [
        el('label', { for: 'e_' + name, text: label }),
        el(type === 'textarea' ? 'textarea' : 'input', { id: 'e_' + name, name: name, type: type || 'text', value: type === 'textarea' ? null : (val == null ? '' : val), text: type === 'textarea' ? (val || '') : null }),
      ]);
    }
    var countySel = el('select', { id: 'e_county', name: 'county' }, [el('option', { value: '', text: '—' })].concat(
      (counties.counties || []).map(function (c) {
        return el('option', { value: c.slug, text: c.name_en, selected: c.slug === rec.county_slug ? '' : null });
      })));

    var catBoxes = el('div', { class: 'checks' }, (cats.categories || []).map(function (c) {
      // category ids aren't in /api/categories; match by slug not possible -> use admin ids list
      return el('label', { class: 'check' }, [
        el('input', { type: 'checkbox', name: 'cat', value: c.id, checked: (rec.category_ids || []).indexOf(c.id) >= 0 ? '' : null }),
        el('span', { text: (c.icon ? c.icon + ' ' : '') + c.name_en }),
      ]);
    }));

    mb.appendChild(el('div', { class: 'grid2' }, [
      input('name', 'Name', rec.name), input('owner_name', 'Owner (private)', rec.owner_name),
      input('town', 'Town', rec.town), el('div', { class: 'form-row' }, [el('label', { text: 'County' }), countySel]),
      input('phone', 'Phone', rec.phone), input('whatsapp', 'WhatsApp', rec.whatsapp),
      input('email', 'Email', rec.email), input('website', 'Website', rec.website),
      input('facebook', 'Facebook', rec.facebook), input('instagram', 'Instagram', rec.instagram),
      input('linkedin', 'LinkedIn', rec.linkedin), input('year_established', 'Year', rec.year_established),
      input('lat', 'Latitude', rec.lat), input('lng', 'Longitude', rec.lng),
    ]));
    mb.appendChild(input('address', 'Address', rec.address));
    mb.appendChild(input('description_sq', 'Description (SQ)', rec.description_sq, 'textarea'));
    mb.appendChild(input('description_en', 'Description (EN)', rec.description_en, 'textarea'));
    mb.appendChild(el('div', { class: 'form-row' }, [el('label', { text: 'Categories' }), catBoxes]));
    mb.appendChild(el('label', { class: 'check', style: 'display:inline-flex;margin-bottom:14px' }, [
      el('input', { id: 'e_show_contact', type: 'checkbox', checked: rec.show_contact ? '' : null }), el('span', { text: 'Show contact publicly' }),
    ]));
    mb.appendChild(el('div', {}, [
      el('button', { class: 'btn btn-primary', text: 'Save changes', onclick: function () { saveEdit(id); } }),
    ]));
    m.hidden = false;
  }
  async function fetchAdminBusiness(id) {
    // Walk statuses to find the record (no single-id admin GET endpoint needed).
    var statuses = ['pending', 'approved', 'rejected', 'removed'];
    for (var i = 0; i < statuses.length; i++) {
      var d = await api('/api/admin/businesses?status=' + statuses[i] + '&pageSize=100');
      var hit = (d.businesses || []).find(function (b) { return b.id === id; });
      if (hit) return hit;
    }
    return null;
  }
  async function saveEdit(id) {
    var g = function (n) { var e = $('#e_' + n); return e ? e.value.trim() : ''; };
    var num = function (n) { var v = g(n); return v === '' ? null : Number(v); };
    var cats = Array.prototype.map.call(document.querySelectorAll('#modal-body input[name=cat]:checked'), function (c) { return Number(c.value); });
    var payload = {
      name: g('name'), owner_name: g('owner_name'), town: g('town'), county: g('county'),
      phone: g('phone'), whatsapp: g('whatsapp'), email: g('email'), website: g('website'),
      facebook: g('facebook'), instagram: g('instagram'), linkedin: g('linkedin'),
      year_established: num('year_established'), lat: num('lat'), lng: num('lng'),
      address: g('address'), description_sq: g('description_sq'), description_en: g('description_en'),
      category_ids: cats, show_contact: $('#e_show_contact').checked,
    };
    try {
      await api('/api/admin/business/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      $('#modal').hidden = true; refresh();
    } catch (e) { alert('Save failed: ' + e.message); }
  }
  $('#modal-close').addEventListener('click', function () { $('#modal').hidden = true; });

  // ---- metrics dashboard --------------------------------------------------
  var METRIC_RANGE = 30; // days

  function statCard(label, value, sub) {
    return el('div', { class: 'stat-card' }, [
      el('div', { class: 'stat-val', text: String(value == null ? 0 : value) }),
      el('div', { class: 'stat-label', text: label }),
      sub ? el('div', { class: 'stat-sub', text: sub }) : null,
    ]);
  }
  // Horizontal bar list (device/browser/country splits, contact channels).
  function barList(rows, keyField, valField, opts) {
    opts = opts || {};
    var max = rows.reduce(function (m, r) { return Math.max(m, r[valField] || 0); }, 0) || 1;
    var wrap = el('div', { class: 'bars' });
    if (!rows.length) { wrap.appendChild(el('p', { class: 'mini-empty', text: '—' })); return wrap; }
    rows.forEach(function (r) {
      var label = opts.labelFn ? opts.labelFn(r) : (r[keyField] || '?');
      var pct = Math.round(((r[valField] || 0) / max) * 100);
      wrap.appendChild(el('div', { class: 'bar-row' }, [
        el('div', { class: 'bar-label', text: label }),
        el('div', { class: 'bar-track' }, [el('div', { class: 'bar-fill', style: 'width:' + pct + '%' })]),
        el('div', { class: 'bar-val', text: String(r[valField] || 0) }),
      ]));
    });
    return wrap;
  }
  // Simple inline-SVG line chart of the daily series (no chart lib).
  function lineChart(daily, field) {
    var W = 640, H = 160, pad = 24;
    if (!daily.length) return el('p', { class: 'mini-empty', text: 'No data yet.' });
    var vals = daily.map(function (d) { return d[field] || 0; });
    var max = Math.max.apply(null, vals) || 1;
    var stepX = daily.length > 1 ? (W - pad * 2) / (daily.length - 1) : 0;
    var pts = daily.map(function (d, i) {
      var x = pad + i * stepX;
      var y = H - pad - ((d[field] || 0) / max) * (H - pad * 2);
      return [x, y];
    });
    var path = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = path + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (H - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (H - pad) + ' Z';
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'linechart');
    var mk = function (tag, attrs) { var n = document.createElementNS(svgNS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; };
    svg.appendChild(mk('path', { d: area, fill: 'rgba(200,16,46,.08)', stroke: 'none' }));
    svg.appendChild(mk('path', { d: path, fill: 'none', stroke: '#c8102e', 'stroke-width': '2', 'stroke-linejoin': 'round' }));
    pts.forEach(function (p) { svg.appendChild(mk('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: '2.5', fill: '#c8102e' })); });
    return svg;
  }

  async function tabMetrics() {
    loading();
    var b = body(); clear(b);
    var picker = el('div', { class: 'inline-form' }, [
      el('div', { class: 'form-row' }, [
        el('label', { text: 'Range' }),
        el('select', { id: 'metric-range', onchange: reload }, [
          el('option', { value: '7', text: 'Last 7 days' }),
          el('option', { value: '30', text: 'Last 30 days', selected: '' }),
          el('option', { value: '90', text: 'Last 90 days' }),
        ]),
      ]),
    ]);
    b.appendChild(picker);
    var panel = el('div', { id: 'metric-body' }, [el('div', { class: 'spinner' })]);
    b.appendChild(panel);
    reload();

    async function reload() {
      var days = Number(($('#metric-range') || {}).value || METRIC_RANGE);
      var since = Date.now() - days * 86400000;
      var box = $('#metric-body'); clear(box); box.appendChild(el('div', { class: 'spinner' }));
      var d;
      try { d = await api('/api/admin/metrics/overview?since=' + since); }
      catch (e) { clear(box); box.appendChild(el('p', { class: 'state', text: 'Could not load metrics: ' + e.message })); return; }
      clear(box);
      var tot = d.totals || {};

      // Headline cards
      box.appendChild(el('div', { class: 'stat-grid' }, [
        statCard('Visitors', tot.visitors, 'unique / day'),
        statCard('Page views', tot.page_views),
        statCard('Business views', tot.business_views),
        statCard('Searches', tot.searches),
        statCard('Contact clicks', tot.contact_clicks),
        statCard('Submissions', tot.submissions),
      ]));

      // Daily activity chart
      box.appendChild(el('div', { class: 'metric-panel' }, [
        el('h3', { text: 'Daily activity' }),
        lineChart(d.daily || [], 'events'),
      ]));

      // Two-column: top businesses + top searches
      box.appendChild(el('div', { class: 'metric-cols' }, [
        el('div', { class: 'metric-panel' }, [
          el('h3', { text: 'Top businesses (profile views)' }),
          barList(d.top_businesses || [], 'name', 'views', { labelFn: function (r) { return r.name || r.slug; } }),
        ]),
        el('div', { class: 'metric-panel' }, [
          el('h3', { text: 'Top searches' }),
          barList(d.top_searches || [], 'query', 'n'),
        ]),
      ]));

      // Zero-result searches (product gold) + contact clicks by channel
      box.appendChild(el('div', { class: 'metric-cols' }, [
        el('div', { class: 'metric-panel gold' }, [
          el('h3', { text: 'Searches with 0 results (unmet demand)' }),
          barList(d.zero_result_searches || [], 'query', 'n'),
        ]),
        el('div', { class: 'metric-panel' }, [
          el('h3', { text: 'Contact clicks by channel' }),
          barList(d.contact_clicks || [], 'channel', 'n'),
        ]),
      ]));

      // Device / browser / country splits
      box.appendChild(el('div', { class: 'metric-cols three' }, [
        el('div', { class: 'metric-panel' }, [el('h3', { text: 'Device' }), barList(d.devices || [], 'k', 'n')]),
        el('div', { class: 'metric-panel' }, [el('h3', { text: 'Browser' }), barList(d.browsers || [], 'k', 'n')]),
        el('div', { class: 'metric-panel' }, [el('h3', { text: 'Country' }), barList(d.countries || [], 'k', 'n')]),
      ]));

      // App vs web
      var appRows = (d.app_split || []).map(function (r) { return { k: r.k === 1 || r.k === '1' ? 'Android app' : 'Web', n: r.visitors }; });
      box.appendChild(el('div', { class: 'metric-panel' }, [
        el('h3', { text: 'App vs web (visitors)' }),
        barList(appRows, 'k', 'n'),
      ]));
    }
  }

  // ---- categories / counties ---------------------------------------------
  async function tabCategories() {
    loading();
    var d = await api('/api/categories').catch(function () { return { categories: [] }; });
    var b = body(); clear(b);
    b.appendChild(el('div', { class: 'inline-form' }, [
      el('div', { class: 'form-row' }, [el('label', { text: 'Name (EN)' }), el('input', { id: 'nc_en' })]),
      el('div', { class: 'form-row' }, [el('label', { text: 'Emri (SQ)' }), el('input', { id: 'nc_sq' })]),
      el('div', { class: 'form-row' }, [el('label', { text: 'Icon' }), el('input', { id: 'nc_icon', style: 'width:70px' })]),
      el('button', { class: 'btn btn-primary', text: '+ Add', onclick: addCategory }),
    ]));
    var table = el('table', { class: 'admin-table' }, [
      el('tr', {}, [el('th', { text: 'Icon' }), el('th', { text: 'EN' }), el('th', { text: 'SQ' }), el('th', { text: 'Count' })]),
    ]);
    (d.categories || []).forEach(function (c) {
      table.appendChild(el('tr', {}, [el('td', { text: c.icon || '' }), el('td', { text: c.name_en }), el('td', { text: c.name_sq }), el('td', { text: c.count })]));
    });
    b.appendChild(table);
    async function addCategory() {
      var en = $('#nc_en').value.trim(), sq = $('#nc_sq').value.trim(), icon = $('#nc_icon').value.trim();
      if (!en || !sq) { alert('Both names required'); return; }
      try { await api('/api/admin/category', mkPost({ name_en: en, name_sq: sq, icon: icon })); tabCategories(); }
      catch (e) { alert(e.message); }
    }
  }
  async function tabCounties() {
    loading();
    var d = await api('/api/counties').catch(function () { return { counties: [] }; });
    var b = body(); clear(b);
    var table = el('table', { class: 'admin-table' }, [el('tr', {}, [el('th', { text: 'EN' }), el('th', { text: 'SQ' }), el('th', { text: 'Slug' }), el('th', { text: 'Count' })])]);
    (d.counties || []).forEach(function (c) {
      table.appendChild(el('tr', {}, [el('td', { text: c.name_en }), el('td', { text: c.name_sq }), el('td', { text: c.slug }), el('td', { text: c.count })]));
    });
    b.appendChild(table);
  }

  // ---- removals -----------------------------------------------------------
  async function tabRemovals() {
    loading();
    var d = await api('/api/admin/removals').catch(function () { return { removals: [] }; });
    var b = body(); clear(b);
    var open = (d.removals || []).filter(function (r) { return r.status === 'open'; });
    $('#removals-count').textContent = open.length || '';
    if (!(d.removals || []).length) { b.appendChild(el('p', { class: 'state', text: 'No removal requests.' })); return; }
    (d.removals || []).forEach(function (r) {
      b.appendChild(el('div', { class: 'admin-card' }, [
        el('div', { class: 'grow' }, [
          el('div', { style: 'display:flex;gap:8px;align-items:center' }, [
            el('h3', { text: r.business_name || ('Business #' + (r.business_id || '?')) }),
            el('span', { class: 'status ' + (r.status === 'open' ? 'pending' : 'approved'), text: r.status }),
          ]),
          el('div', { class: 'meta', text: '✉ ' + r.email }),
          r.reason ? el('div', { class: 'meta', text: r.reason }) : null,
          r.status === 'open' ? el('div', { class: 'row-actions' }, [
            el('button', { class: 'btn btn-sm btn-danger', text: 'Process (remove)', onclick: function () { processRemoval(r.id, 'processed'); } }),
            el('button', { class: 'btn btn-sm btn-ghost', text: 'Dismiss', onclick: function () { processRemoval(r.id, 'rejected'); } }),
          ]) : null,
        ]),
      ]));
    });
    async function processRemoval(id, action) {
      if (!confirm(action === 'processed' ? 'Remove the business and close this request?' : 'Dismiss this request?')) return;
      try { await api('/api/admin/removal/' + id + '/process', mkPost({ action: action })); tabRemovals(); }
      catch (e) { alert(e.message); }
    }
  }

  // ---- export -------------------------------------------------------------
  function tabExport() {
    var b = body(); clear(b);
    b.appendChild(el('div', { class: 'form-section' }, [
      el('h2', { style: 'margin-top:0', text: 'Export directory' }),
      el('p', { class: 'hint', text: 'Download every business (all statuses) as CSV — includes private fields. Handle per GDPR.' }),
      el('button', { class: 'btn btn-primary', text: '⬇ Download CSV', onclick: downloadCsv }),
    ]));
    async function downloadCsv() {
      try {
        var resp = await fetch(API + '/api/admin/export.csv', { credentials: 'include', headers: authHeaders({}) });
        if (!resp.ok) { showGate(); return; }
        var blob = await resp.blob();
        var url = URL.createObjectURL(blob);
        var a = el('a', { href: url, download: 'albabiz-export.csv' });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      } catch (e) { alert(e.message); }
    }
  }

  // ---- boot ---------------------------------------------------------------
  async function boot() {
    if (!API || API.indexOf('YOUR-SUBDOMAIN') >= 0) {
      $('#gate').hidden = true; $('#app').hidden = true;
      document.body.appendChild(el('div', { class: 'container' }, [el('div', { class: 'alert alert-err', style: 'margin-top:40px', html: '⚠️ Set <code>API_BASE</code> in <code>/config.js</code> first.' })]));
      return;
    }
    try {
      var d = await api('/api/admin/pending');
      showApp();
      $('#pending-count').textContent = d.total || '';
      var b = body(); clear(b);
      $('#who').textContent = token() ? 'Signed in (token)' : 'Signed in (Access)';
      if (!(d.businesses || []).length) b.appendChild(el('p', { class: 'state', text: 'No pending submissions 🎉' }));
      else d.businesses.forEach(function (x) { b.appendChild(bizCard(x)); });
    } catch (e) { /* showGate already called on 401/403 */ }
  }
  boot();
})();
