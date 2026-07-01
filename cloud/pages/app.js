/*
 * AlbaBiz.ie — single-page app (no framework, no build).
 * History-API router with clean URLs (/biznes/<slug>, /kategoria/<slug>,
 * /kontea/<slug>, /regjistro, /hiq). The Pages `_redirects` file rewrites
 * unknown paths to /index.html so deep links work on refresh.
 *
 * This same site is what the Android WebView loads.
 */
(function () {
  'use strict';

  const CFG = window.ALBABIZ_CONFIG || {};
  const API = (CFG.API_BASE || '').replace(/\/$/, '');
  const t = (k) => window.I18N.t(k);
  const main = document.getElementById('main');

  // ---- tiny DOM helpers ---------------------------------------------------
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function setMain(node) { clear(main); main.appendChild(node); window.scrollTo(0, 0); }
  function spinner() { return el('div', { class: 'spinner', 'aria-label': t('common.loading') }); }

  // ---- icons (Lucide via icons.js) ----------------------------------------
  // ic(name) -> an <svg> node ; icHTML(name) -> string for `html` attrs.
  const ic = (name, opts) => (window.icon ? window.icon(name, opts) : el('span'));
  const icHTML = (name, opts) => (window.iconHTML ? window.iconHTML(name, opts) : '');
  // metrics — safe no-op if metrics.js absent.
  const track = (type, props) => { try { if (window.albabizTrack) window.albabizTrack(type, props); } catch (e) {} };
  // Map each category slug to a Lucide glyph (mirrors the DB icon keys).
  const CAT_ICON = {
    'construction-trades': 'hard-hat', 'automotive-car-sales': 'car',
    'car-wash-valeting': 'droplets', 'food-restaurants': 'utensils-crossed',
    'food-retail-grocery': 'shopping-cart', 'beauty-barber': 'scissors',
    'cleaning-services': 'spray-can', 'professional-services': 'briefcase',
    'real-estate': 'home', 'health-wellness': 'heart-pulse',
    'education-language': 'graduation-cap', 'transport-logistics': 'truck',
    'retail': 'shopping-bag', 'it-digital': 'monitor', 'other': 'circle-dot',
  };
  const catIcon = (slug) => CAT_ICON[slug] || 'circle-dot';
  // State pane: a branded empty/error block with an icon.
  function statePane(iconName, titleText, bodyText, extra) {
    return el('div', { class: 'state' }, [
      el('div', { class: 'state-ico' }, [ic(iconName)]),
      titleText ? el('h3', { text: titleText }) : null,
      bodyText ? el('p', { text: bodyText }) : null,
      extra || null,
    ]);
  }
  // Skeleton grid while loading.
  function skeletonGrid(n) {
    const g = el('div', { class: 'skeleton-grid' });
    for (let i = 0; i < (n || 6); i++) {
      g.appendChild(el('div', { class: 'skeleton' }, [
        el('div', { class: 'sk-media' }),
        el('div', { class: 'sk-line' }), el('div', { class: 'sk-line short' }),
      ]));
    }
    return g;
  }


  // ---- API client ---------------------------------------------------------
  async function api(path, opts) {
    const resp = await fetch(API + path, opts);
    const txt = await resp.text();
    let body = null;
    try { body = txt ? JSON.parse(txt) : null; } catch { body = { raw: txt }; }
    if (!resp.ok) throw new Error((body && body.error) || ('http_' + resp.status));
    return body;
  }

  // ---- SEO helpers --------------------------------------------------------
  function setMeta(title, desc) {
    document.title = title;
    const d = document.querySelector('meta[name=description]');
    if (d && desc) d.setAttribute('content', desc);
    const ogt = document.querySelector('meta[property="og:title"]');
    if (ogt) ogt.setAttribute('content', title);
    const ogd = document.querySelector('meta[property="og:description"]');
    if (ogd && desc) ogd.setAttribute('content', desc);
  }
  function setJsonLd(obj) {
    let s = document.getElementById('jsonld');
    if (!s) { s = el('script', { type: 'application/ld+json', id: 'jsonld' }); document.head.appendChild(s); }
    s.textContent = obj ? JSON.stringify(obj) : '';
  }

  // ---- shared rendering ---------------------------------------------------
  function businessCard(b) {
    const desc = window.I18N.field(b, 'description');
    const primaryCat = (b.categories && b.categories[0]) ? b.categories[0].slug : 'other';
    const media = b.logo
      ? el('img', { src: API + b.logo, alt: b.name, loading: 'lazy' })
      : el('div', { class: 'card-tile' }, [ic(catIcon(primaryCat), { class: 'tile-ico' })]);
    const cats = (b.categories || []).slice(0, 3).map((c) =>
      el('span', { class: 'tag' }, [ic(catIcon(c.slug)), document.createTextNode(window.I18N.name(c))])
    );
    const meta = [];
    if (b.county) meta.push(window.I18N.name(b.county));
    if (b.town) meta.push(b.town);
    return el('a', { class: 'card', href: '/biznes/' + b.slug, 'data-link': '' }, [
      el('div', { class: 'card-media' }, [
        b.is_featured ? el('span', { class: 'badge-featured' }, [ic('star'), document.createTextNode(t('card.featured'))]) : null,
        media,
      ]),
      el('div', { class: 'card-body' }, [
        el('h3', { class: 'card-title', text: b.name }),
        meta.length ? el('div', { class: 'card-meta' }, [ic('map-pin'), document.createTextNode(meta.join(' · '))]) : null,
        desc ? el('p', { class: 'card-desc', text: desc }) : null,
        cats.length ? el('div', { class: 'card-cats' }, cats) : null,
      ]),
    ]);
  }

  function header(titleText, subText) {
    return el('div', { class: 'section-head' }, [
      el('h1', { class: 'section-title', text: titleText }),
      subText ? el('p', { class: 'section-sub', text: subText }) : null,
    ]);
  }

  // ---- state for the directory view --------------------------------------
  const dir = { county: '', category: '', q: '', view: 'list', map: null, page: 1, loading: false };

  // =========================================================================
  // VIEW: Home / directory (list + map toggle)
  // =========================================================================
  async function viewHome(params) {
    setMeta('AlbaBiz.ie — ' + t('home.title'), t('home.subtitle'));
    setJsonLd({
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'AlbaBiz.ie',
      url: location.origin, description: t('home.subtitle'),
    });
    dir.county = params.get('county') || '';
    dir.category = params.get('category') || '';
    dir.q = params.get('q') || '';

    const root = el('div', {});
    // Hero + search
    const hero = el('section', { class: 'hero' }, [
      el('div', { class: 'container' }, [
        el('div', { class: 'hero-inner' }, [
          el('h1', { text: t('home.title') }),
          el('p', { text: t('home.subtitle') }),
          buildSearchBar(),
        ]),
      ]),
    ]);
    root.appendChild(hero);

    const container = el('div', { class: 'container' });
    container.appendChild(el('div', { id: 'chips', class: 'chips' }));
    container.appendChild(buildToolbar());
    container.appendChild(el('div', { id: 'results' }, [skeletonGrid()]));
    root.appendChild(container);
    setMain(root);

    await Promise.all([loadCategoryChips(), runSearch()]);
  }

  function buildSearchBar() {
    const bar = el('form', { class: 'searchbar', role: 'search', onsubmit: (e) => { e.preventDefault(); applyFilters(); } }, [
      el('div', { class: 'field', style: 'flex:2 1 260px' }, [
        ic('search'),
        el('input', { id: 'q', type: 'text', value: dir.q, placeholder: t('search.placeholder'), 'aria-label': t('search.placeholder') }),
      ]),
      el('div', { class: 'field' }, [
        ic('map-pin'),
        el('select', { id: 'county', 'aria-label': t('filter.county') }, [el('option', { value: '', text: t('filter.allCounties') })]),
      ]),
      el('button', { class: 'btn btn-primary', type: 'submit' }, [ic('search'), document.createTextNode(t('search.button'))]),
    ]);
    // fill counties async
    api('/api/counties').then((d) => {
      const sel = bar.querySelector('#county');
      (d.counties || []).forEach((c) => {
        const o = el('option', { value: c.slug, text: window.I18N.name(c) + (c.count ? ' (' + c.count + ')' : '') });
        if (c.slug === dir.county) o.selected = true;
        sel.appendChild(o);
      });
    }).catch(() => {});
    return bar;
  }

  function buildToolbar() {
    return el('div', { class: 'toolbar' }, [
      el('span', { id: 'count', class: 'count', text: '' }),
      el('span', { class: 'grow' }),
      el('div', { class: 'viewtoggle', role: 'group', 'aria-label': 'View' }, [
        el('button', { type: 'button', 'data-view': 'list', 'aria-pressed': String(dir.view === 'list'), onclick: () => switchView('list') }, [ic('list'), document.createTextNode(t('view.list'))]),
        el('button', { type: 'button', 'data-view': 'map', 'aria-pressed': String(dir.view === 'map'), onclick: () => switchView('map') }, [ic('map-pin'), document.createTextNode(t('view.map'))]),
      ]),
    ]);
  }

  async function loadCategoryChips() {
    try {
      const d = await api('/api/categories');
      const wrap = document.getElementById('chips');
      if (!wrap) return;
      clear(wrap);
      const all = el('button', { class: 'chip', 'aria-pressed': String(!dir.category), onclick: () => { dir.category = ''; applyFilters(); } }, [ic('sparkles'), document.createTextNode(t('filter.allCategories'))]);
      wrap.appendChild(all);
      (d.categories || []).forEach((c) => {
        wrap.appendChild(el('button', {
          class: 'chip', 'aria-pressed': String(dir.category === c.slug),
          onclick: () => { const next = (dir.category === c.slug ? '' : c.slug); if (next) track('filter', { filter_type: 'category', filter_value: next }); dir.category = next; applyFilters(); },
        }, [ic(catIcon(c.slug)), document.createTextNode(window.I18N.name(c) + (c.count ? ' (' + c.count + ')' : ''))]));
      });
    } catch {}
  }

  function applyFilters() {
    const q = document.getElementById('q');
    const county = document.getElementById('county');
    dir.q = q ? q.value.trim() : dir.q;
    dir.county = county ? county.value : dir.county;
    dir.page = 1;
    // reflect filters in the URL (shareable) without reloading
    const usp = new URLSearchParams();
    if (dir.q) usp.set('q', dir.q);
    if (dir.county) usp.set('county', dir.county);
    if (dir.category) usp.set('category', dir.category);
    history.replaceState({}, '', '/' + (usp.toString() ? '?' + usp.toString() : ''));
    loadCategoryChips();
    runSearch();
  }

  function switchView(v) {
    dir.view = v;
    track('view_toggle', { filter_type: 'view', filter_value: v });
    document.querySelectorAll('.viewtoggle button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === v)));
    runSearch();
  }

  async function runSearch() {
    const box = document.getElementById('results');
    if (!box) return;
    clear(box); box.appendChild(spinner());
    const usp = new URLSearchParams();
    if (dir.county) usp.set('county', dir.county);
    if (dir.category) usp.set('category', dir.category);
    if (dir.q) usp.set('q', dir.q);
    usp.set('pageSize', '60');
    try {
      const d = await api('/api/businesses?' + usp.toString());
      const list = d.businesses || [];
      const countEl = document.getElementById('count');
      if (countEl) { clear(countEl); countEl.appendChild(el('b', { text: String(d.total) })); countEl.appendChild(document.createTextNode(' ' + t('results.count'))); }
      // Track searches (incl. zero-result = unmet demand) when a query is present.
      if (dir.q) track('search', { query: dir.q, result_count: d.total });
      clear(box);
      if (!list.length) {
        box.appendChild(statePane('search', t('results.none'), t('results.noneHint')));
        return;
      }
      if (dir.view === 'map') renderMap(box, list);
      else {
        const grid = el('div', { class: 'grid' });
        list.forEach((b) => grid.appendChild(businessCard(b)));
        box.appendChild(grid);
      }
    } catch (e) {
      clear(box);
      box.appendChild(el('div', { class: 'alert alert-err' }, [ic('wifi-off'), el('span', { text: t('form.errGeneric') + ' (' + e.message + ')' })]));
    }
  }

  function renderMap(box, list) {
    const mapDiv = el('div', { id: 'map' });
    box.appendChild(mapDiv);
    const withCoords = list.filter((b) => typeof b.lat === 'number' && typeof b.lng === 'number');
    // Default to the centre of Ireland if nothing has coords yet.
    const center = withCoords.length ? [withCoords[0].lat, withCoords[0].lng] : [53.4, -7.9];
    const map = L.map(mapDiv, { scrollWheelZoom: false }).setView(center, withCoords.length ? 9 : 7);
    // CARTO Positron — soft, muted basemap that matches the warm palette.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
      attribution: '© OpenStreetMap, © CARTO',
    }).addTo(map);
    // Custom on-brand red pin (SVG divIcon).
    const pinHtml = '<svg class="map-pin" width="30" height="30" viewBox="0 0 24 24" fill="#c8102e" stroke="#fff" stroke-width="1.5"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="none"/></svg>';
    const redPin = L.divIcon({ html: pinHtml, className: 'map-pin-wrap', iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -26] });
    const bounds = [];
    withCoords.forEach((b) => {
      const m = L.marker([b.lat, b.lng], { icon: redPin }).addTo(map);
      m.bindPopup('<p class="map-pop-title">' + esc(b.name) + '</p>' +
        '<p class="map-pop-meta">' + esc([b.town, b.county && window.I18N.name(b.county)].filter(Boolean).join(', ')) + '</p>' +
        '<a href="/biznes/' + esc(b.slug) + '" data-link>' + esc(t('card.viewProfile')) + ' →</a>');
      bounds.push([b.lat, b.lng]);
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
    setTimeout(() => map.invalidateSize(), 100);
    if (!withCoords.length) {
      box.appendChild(el('p', { class: 'section-sub', style: 'text-align:center', text: list.length + ' ' + t('results.count') + ' — pa koordinata / awaiting map pins.' }));
    }
  }

  // =========================================================================
  // VIEW: Business detail
  // =========================================================================
  async function viewBusiness(slug) {
    setMain(spinner());
    let d;
    try { d = await api('/api/businesses/' + encodeURIComponent(slug)); }
    catch { return view404(); }
    const b = d.business;
    const desc = window.I18N.field(b, 'description');
    track('business_view', { slug: b.slug });
    setMeta(b.name + ' — AlbaBiz.ie', desc || (b.name + ' — ' + (b.county ? window.I18N.name(b.county) : 'Ireland')));

    // Normalize a user-entered WEBSITE: bare domains (e.g. "example.ie") have no
    // scheme and would otherwise resolve RELATIVE to /biznes/<slug>. Force an
    // absolute https:// URL so the link opens the real external site.
    function extUrl(u) {
      if (!u) return u;
      u = String(u).trim();
      if (!u) return u;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u; // already absolute (http/https/…)
      return 'https://' + u.replace(/^\/+/, '');        // bare domain / //host
    }
    // Normalize a SOCIAL field, which owners often enter as a bare handle
    // ("theleveldetailing" or "@theleveldetailing") rather than a full URL.
    // Handles -> the platform profile URL; anything with a scheme or a path is
    // treated as a URL and just made absolute.
    var SOCIAL_BASE = {
      facebook: 'https://facebook.com/', instagram: 'https://instagram.com/',
      linkedin: 'https://www.linkedin.com/in/',
    };
    function socialUrl(kind, u) {
      if (!u) return u;
      u = String(u).trim().replace(/^@/, '');
      if (!u) return u;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u;    // already absolute
      if (u.indexOf('/') >= 0) return 'https://' + u.replace(/^\/+/, ''); // host/path
      return (SOCIAL_BASE[kind] || 'https://') + u;         // bare handle
    }

    // JSON-LD LocalBusiness
    const ld = {
      '@context': 'https://schema.org', '@type': 'LocalBusiness',
      name: b.name, url: location.origin + '/biznes/' + b.slug,
    };
    if (desc) ld.description = desc;
    if (b.logo) ld.image = API + b.logo;
    if (b.phone) ld.telephone = b.phone;
    if (b.website) ld.sameAs = [extUrl(b.website), socialUrl('facebook', b.facebook), socialUrl('instagram', b.instagram), socialUrl('linkedin', b.linkedin)].filter(Boolean);
    if (b.address || b.town || b.county) {
      ld.address = { '@type': 'PostalAddress', addressCountry: 'IE' };
      if (b.address) ld.address.streetAddress = b.address;
      if (b.town) ld.address.addressLocality = b.town;
      if (b.county) ld.address.addressRegion = window.I18N.name(b.county);
    }
    if (typeof b.lat === 'number' && typeof b.lng === 'number') {
      ld.geo = { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng };
    }
    setJsonLd(ld);

    const primaryCat = (b.categories && b.categories[0]) ? b.categories[0].slug : 'other';
    const logo = b.logo ? el('img', { src: API + b.logo, alt: b.name })
                        : ic(catIcon(primaryCat));

    // contact panel
    const contactRows = [];
    const CHANNEL_OF = { phone: 'phone', whatsapp: 'whatsapp', mail: 'email', globe: 'website', facebook: 'facebook', instagram: 'instagram', linkedin: 'linkedin' };
    function row(iconName, label, value, href, brand) {
      const channel = CHANNEL_OF[iconName] || iconName;
      const valNode = href
        ? el('a', { class: 'c-val', href, target: href.startsWith('http') ? '_blank' : null, rel: 'noopener', text: value,
                    onclick: () => track('contact_click', { slug: b.slug, channel: channel }) })
        : el('span', { class: 'c-val', text: value });
      contactRows.push(el('div', { class: 'contact-row' }, [
        el('span', { class: 'ico-wrap' }, [ic(iconName, brand ? { brand: 1 } : undefined)]),
        el('div', {}, [
          el('div', { class: 'c-label', text: label }),
          valNode,
        ]),
      ]));
    }
    if (b.phone) row('phone', t('detail.phone'), b.phone, 'tel:' + b.phone);
    if (b.whatsapp) row('whatsapp', t('detail.whatsapp'), b.whatsapp, 'https://wa.me/' + b.whatsapp.replace(/[^0-9]/g, ''), true);
    if (b.email) row('mail', t('detail.email'), b.email, 'mailto:' + b.email);
    if (b.website) row('globe', t('detail.website'), b.website.replace(/^https?:\/\//, ''), extUrl(b.website));
    if (b.facebook) row('facebook', 'Facebook', 'Facebook', socialUrl('facebook', b.facebook), true);
    if (b.instagram) row('instagram', 'Instagram', 'Instagram', socialUrl('instagram', b.instagram), true);
    if (b.linkedin) row('linkedin', 'LinkedIn', 'LinkedIn', socialUrl('linkedin', b.linkedin), true);
    if (!contactRows.length) contactRows.push(el('p', { class: 'section-sub', text: t('detail.contactHidden') }));

    const cats = (b.categories || []).map((c) =>
      el('a', { class: 'tag', href: '/kategoria/' + c.slug, 'data-link': '' }, [ic(catIcon(c.slug)), document.createTextNode(window.I18N.name(c))]));

    const locActions = [];
    if (typeof b.lat === 'number' && typeof b.lng === 'number') {
      locActions.push(el('a', { class: 'btn btn-ghost btn-sm', target: '_blank', rel: 'noopener',
        href: 'https://www.openstreetmap.org/?mlat=' + b.lat + '&mlon=' + b.lng + '#map=17/' + b.lat + '/' + b.lng,
        onclick: () => track('contact_click', { slug: b.slug, channel: 'directions' }),
      }, [ic('navigation'), document.createTextNode(t('detail.directions'))]));
    }

    const root = el('div', { class: 'container' }, [
      el('p', { class: 'breadcrumb' }, [
        el('a', { href: '/', 'data-link': '' }, [ic('chevron-left'), document.createTextNode(t('detail.back'))]),
      ]),
      el('div', { class: 'detail-head' }, [
        el('div', { class: 'detail-logo' }, [logo]),
        el('div', { style: 'flex:1 1 240px' }, [
          el('h1', { class: 'detail-title', text: b.name }),
          el('p', { class: 'detail-sub' }, [ic('map-pin'), document.createTextNode([b.town, b.county && window.I18N.name(b.county)].filter(Boolean).join(', '))]),
        ]),
      ]),
      el('div', { class: 'detail-grid' }, [
        el('div', {}, [
          desc ? el('section', { class: 'panel' }, [el('h2', { text: t('detail.about') }), el('p', { text: desc })]) : null,
          cats.length ? el('section', { class: 'panel', style: 'margin-top:18px' }, [el('h2', { text: t('detail.categories') }), el('div', { class: 'card-cats' }, cats)]) : null,
          (b.address || locActions.length) ? el('section', { class: 'panel', style: 'margin-top:18px' }, [
            el('h2', { text: t('detail.location') }),
            b.address ? el('p', { text: b.address }) : null,
            locActions.length ? el('div', { class: 'actions' }, locActions) : null,
          ]) : null,
        ]),
        el('div', {}, [
          el('section', { class: 'panel' }, [el('h2', { text: t('detail.contact') }), el('div', {}, contactRows)]),
          b.year_established ? el('p', { class: 'section-sub', style: 'margin-top:14px', text: t('detail.established') + ' ' + b.year_established }) : null,
          el('p', { style: 'margin-top:14px' }, [
            el('a', { href: '/hiq?slug=' + encodeURIComponent(b.slug), 'data-link': '', class: 'section-sub', style: 'display:inline-flex;align-items:center;gap:5px' }, [ic('send'), document.createTextNode(t('detail.report'))]),
          ]),
        ]),
      ]),
    ]);
    setMain(root);
  }

  // =========================================================================
  // VIEW: Category / County landing (SEO-friendly)
  // =========================================================================
  async function viewCategory(slug) {
    setMain(spinner());
    const [catData] = await Promise.all([api('/api/categories').catch(() => ({ categories: [] }))]);
    const cat = (catData.categories || []).find((c) => c.slug === slug);
    const title = (cat ? window.I18N.name(cat) : slug);
    setMeta(t('cat.title') + ' ' + title + ' — AlbaBiz.ie', title + ' — Albanian businesses in Ireland.');
    const root = el('div', { class: 'container' }, [
      el('p', { class: 'breadcrumb' }, [el('a', { href: '/', 'data-link': '' }, [ic('chevron-left'), document.createTextNode(t('detail.back'))])]),
      el('div', { class: 'landing-head' }, [
        el('div', { class: 'landing-icon' }, [ic(catIcon(slug))]),
        el('div', {}, [el('h1', { class: 'section-title', style: 'margin:0', text: title }), el('p', { class: 'section-sub', style: 'margin:2px 0 0', text: t('cat.title') })]),
      ]),
      el('div', { id: 'results' }, [skeletonGrid()]),
    ]);
    setMain(root);
    await renderListInto('results', '/api/businesses?pageSize=60&category=' + encodeURIComponent(slug));
  }

  async function viewCounty(slug) {
    setMain(spinner());
    const data = await api('/api/counties').catch(() => ({ counties: [] }));
    const county = (data.counties || []).find((c) => c.slug === slug);
    const title = county ? window.I18N.name(county) : slug;
    setMeta(t('county.title') + ' ' + title + ' — AlbaBiz.ie', 'Albanian businesses in ' + title + ', Ireland.');
    const root = el('div', { class: 'container' }, [
      el('p', { class: 'breadcrumb' }, [el('a', { href: '/', 'data-link': '' }, [ic('chevron-left'), document.createTextNode(t('detail.back'))])]),
      el('div', { class: 'landing-head' }, [
        el('div', { class: 'landing-icon' }, [ic('map-pin')]),
        el('div', {}, [el('h1', { class: 'section-title', style: 'margin:0', text: title }), el('p', { class: 'section-sub', style: 'margin:2px 0 0', text: t('county.title') })]),
      ]),
      el('div', { id: 'results' }, [skeletonGrid()]),
    ]);
    setMain(root);
    await renderListInto('results', '/api/businesses?pageSize=60&county=' + encodeURIComponent(slug));
  }

  async function renderListInto(id, path) {
    const box = document.getElementById(id);
    try {
      const d = await api(path);
      const list = d.businesses || [];
      clear(box);
      if (!list.length) {
        box.appendChild(statePane('search', t('results.none'), t('results.noneHint')));
        return;
      }
      const grid = el('div', { class: 'grid' });
      list.forEach((b) => grid.appendChild(businessCard(b)));
      box.appendChild(grid);
    } catch (e) {
      clear(box); box.appendChild(el('div', { class: 'alert alert-err' }, [ic('wifi-off'), el('span', { text: e.message })]));
    }
  }

  // =========================================================================
  // VIEW: Submission form
  // =========================================================================
  async function viewSubmit() {
    setMeta(t('form.title') + ' — AlbaBiz.ie', t('form.subtitle'));
    setJsonLd(null);
    const root = el('div', { class: 'container form-wrap' });
    root.appendChild(header(t('form.title'), t('form.subtitle')));
    const msg = el('div', { id: 'form-msg', 'aria-live': 'polite' });
    root.appendChild(msg);

    const form = el('form', { id: 'submit-form', enctype: 'multipart/form-data', novalidate: '' });

    function fieldRow(opts) {
      const id = opts.name;
      const input = opts.textarea
        ? el('textarea', { id, name: opts.name, maxlength: opts.maxlength || 2000 })
        : el('input', { id, name: opts.name, type: opts.type || 'text', maxlength: opts.maxlength, placeholder: opts.placeholder || '' });
      if (opts.required) input.setAttribute('required', '');
      return el('div', { class: 'form-row' }, [
        el('label', { for: id, html: esc(opts.label) + (opts.required ? ' <span class="req">*</span>' : '') }),
        input,
        opts.hint ? el('div', { class: 'hint', text: opts.hint }) : null,
      ]);
    }

    // Business section
    const sBiz = el('div', { class: 'form-section' }, [
      el('h2', {}, [ic('building-2'), document.createTextNode(t('form.secBusiness'))]),
      fieldRow({ name: 'name', label: t('form.name'), required: true, maxlength: 200 }),
      fieldRow({ name: 'owner_name', label: t('form.owner'), hint: t('form.ownerHint'), maxlength: 200 }),
      el('div', { class: 'form-row' }, [
        el('label', { for: 'category', html: esc(t('form.categories')) + ' <span class="req">*</span>' }),
        el('select', { id: 'category', name: 'category_single' }, [el('option', { value: '', text: t('form.selectCategory') })]),
      ]),
      fieldRow({ name: 'description_sq', label: t('form.descSq'), textarea: true }),
      fieldRow({ name: 'description_en', label: t('form.descEn'), textarea: true }),
      fieldRow({ name: 'year_established', label: t('form.year'), type: 'number' }),
    ]);

    // Location
    const countySelect = el('select', { id: 'county', name: 'county' }, [el('option', { value: '', text: t('common.selectCounty') })]);
    const sLoc = el('div', { class: 'form-section' }, [
      el('h2', {}, [ic('map-pin'), document.createTextNode(t('form.secLocation'))]),
      el('div', { class: 'form-row' }, [el('label', { for: 'county', html: esc(t('form.county')) + ' <span class="req">*</span>' }), countySelect]),
      fieldRow({ name: 'town', label: t('form.town'), maxlength: 120 }),
      fieldRow({ name: 'address', label: t('form.address'), maxlength: 300 }),
    ]);

    // Contact
    const sContact = el('div', { class: 'form-section' }, [
      el('h2', {}, [ic('phone'), document.createTextNode(t('form.secContact'))]),
      fieldRow({ name: 'phone', label: t('form.phone'), type: 'tel', maxlength: 40 }),
      fieldRow({ name: 'whatsapp', label: t('form.whatsapp'), type: 'tel', maxlength: 40 }),
      fieldRow({ name: 'email', label: t('form.email'), type: 'email', maxlength: 254 }),
      fieldRow({ name: 'website', label: t('form.website'), type: 'url', maxlength: 300 }),
      fieldRow({ name: 'facebook', label: t('form.facebook'), type: 'url', maxlength: 300 }),
      fieldRow({ name: 'instagram', label: t('form.instagram'), type: 'url', maxlength: 300 }),
      fieldRow({ name: 'linkedin', label: t('form.linkedin'), type: 'url', maxlength: 300 }),
      el('div', { class: 'form-row' }, [
        el('label', { class: 'check', style: 'display:flex' }, [
          el('input', { type: 'checkbox', name: 'show_contact', checked: '' }),
          el('span', { text: t('form.showContact') }),
        ]),
      ]),
    ]);

    // Media + consent
    // Logo input is camera-first on mobile (`capture=environment` opens the rear
    // camera). Because a logo is often an existing image — and some mobile
    // browsers treat `capture` as camera-ONLY — we offer a "from gallery"
    // fallback that drops `capture` for one pick, then restores it.
    const logoInput = el('input', {
      id: 'logo', name: 'logo', type: 'file',
      accept: 'image/png,image/jpeg,image/webp',
      capture: 'environment',
    });
    const galleryBtn = el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', style: 'margin-top:8px',
      onclick: () => {
        logoInput.removeAttribute('capture');     // this pick: let them browse
        logoInput.click();
        // Restore camera-first once the picker closes (window regains focus).
        window.addEventListener('focus', function restore() {
          logoInput.setAttribute('capture', 'environment');
        }, { once: true });
      },
      text: t('form.logoGallery'),
    });
    const sMedia = el('div', { class: 'form-section' }, [
      el('h2', {}, [ic('sparkles'), document.createTextNode(t('form.secMedia'))]),
      el('div', { class: 'form-row' }, [
        el('label', { for: 'logo', html: esc(t('form.logo')) }),
        logoInput,
        el('div', { class: 'hint', text: t('form.logoCameraHint') }),
        galleryBtn,
      ]),
      el('div', { class: 'form-row' }, [
        el('label', { class: 'consent' }, [
          el('input', { type: 'checkbox', name: 'gdpr_consent', required: '' }),
          el('span', { text: t('form.gdpr') }),
        ]),
      ]),
      // Turnstile widget
      el('div', { class: 'cf-turnstile', 'data-sitekey': CFG.TURNSTILE_SITE_KEY || '' }),
    ]);

    const submitBtn = el('button', { class: 'btn btn-primary', type: 'submit', style: 'min-width:200px', text: t('form.submit') });
    form.appendChild(sBiz); form.appendChild(sLoc); form.appendChild(sContact); form.appendChild(sMedia);
    form.appendChild(submitBtn);
    root.appendChild(form);
    setMain(root);

    // populate counties + categories
    api('/api/counties').then((d) => (d.counties || []).forEach((c) =>
      countySelect.appendChild(el('option', { value: c.slug, text: window.I18N.name(c) })))).catch(() => {});
    api('/api/categories').then((d) => {
      const sel = document.getElementById('category');
      if (!sel) return;
      (d.categories || []).forEach((c) =>
        sel.appendChild(el('option', { value: c.id, text: window.I18N.name(c) })));
    }).catch(() => {});
    loadTurnstile();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clear(msg);
      track('submit_start', { path: '/regjistro' });
      const name = form.querySelector('[name=name]').value.trim();
      if (!name) { msg.appendChild(el('div', { class: 'alert alert-err', text: t('form.errName') })); return; }
      if (!form.querySelector('[name=gdpr_consent]').checked) { msg.appendChild(el('div', { class: 'alert alert-err', text: t('form.errGdpr') })); return; }

      const fd = new FormData(form);
      // normalize checkboxes to explicit booleans the Worker expects
      fd.set('gdpr_consent', 'true');
      fd.set('show_contact', form.querySelector('[name=show_contact]').checked ? 'true' : 'false');
      // single category dropdown -> the Worker's `categories` field (comma list)
      const catSel = form.querySelector('[name=category_single]');
      fd.delete('category_single');
      if (catSel && catSel.value) fd.set('categories', catSel.value);
      // turnstile token (widget injects a hidden input named cf-turnstile-response)
      submitBtn.disabled = true; submitBtn.textContent = t('form.sending');
      try {
        const d = await api('/api/submit', { method: 'POST', body: fd });
        if (d && d.ok) {
          track('submit_success', { path: '/regjistro' });
          const ok = el('div', { class: 'form-section', style: 'text-align:center' }, [
            el('div', { class: 'state' }, [
              el('div', { class: 'state-ico' }, [ic('sparkles')]),
              el('h2', { text: t('form.okTitle') }),
              el('p', { text: t('form.okBody') }),
              el('a', { class: 'btn btn-primary', href: '/', 'data-link': '', text: t('nav.home') }),
            ]),
          ]);
          setMain(el('div', { class: 'container form-wrap' }, [ok]));
        } else throw new Error((d && d.error) || 'err');
      } catch (err) {
        const key = err.message === 'turnstile_failed' ? 'form.errTurnstile'
          : err.message === 'gdpr_consent_required' ? 'form.errGdpr'
          : err.message === 'name_required' ? 'form.errName' : 'form.errGeneric';
        msg.appendChild(el('div', { class: 'alert alert-err', text: t(key) }));
        submitBtn.disabled = false; submitBtn.textContent = t('form.submit');
        if (window.turnstile) try { window.turnstile.reset(); } catch {}
      }
    });
  }

  // =========================================================================
  // VIEW: Removal request
  // =========================================================================
  async function viewRemoval(params) {
    setMeta(t('removal.title') + ' — AlbaBiz.ie', t('removal.subtitle'));
    setJsonLd(null);
    const root = el('div', { class: 'container form-wrap' });
    root.appendChild(header(t('removal.title'), t('removal.subtitle')));
    const msg = el('div', { id: 'rm-msg', 'aria-live': 'polite' });
    root.appendChild(msg);
    const form = el('form', { id: 'removal-form', novalidate: '' }, [
      el('div', { class: 'form-section' }, [
        rowText('business_name', t('removal.business')),
        rowText('slug', t('removal.slug'), params.get('slug') || ''),
        rowText('email', t('removal.email'), '', 'email', true),
        el('div', { class: 'form-row' }, [el('label', { for: 'reason', html: esc(t('removal.reason')) }), el('textarea', { id: 'reason', name: 'reason' })]),
        el('div', { class: 'cf-turnstile', 'data-sitekey': CFG.TURNSTILE_SITE_KEY || '' }),
      ]),
      el('button', { class: 'btn btn-primary', type: 'submit', text: t('removal.submit') }),
    ]);
    root.appendChild(form);
    setMain(root);
    loadTurnstile();

    function rowText(name, label, val, type, req) {
      const i = el('input', { id: name, name, type: type || 'text', value: val || '' });
      if (req) i.setAttribute('required', '');
      return el('div', { class: 'form-row' }, [el('label', { for: name, html: esc(label) + (req ? ' <span class="req">*</span>' : '') }), i]);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault(); clear(msg);
      const body = {
        business_name: form.business_name.value.trim(),
        slug: form.slug.value.trim(),
        email: form.email.value.trim(),
        reason: form.reason.value.trim(),
        'cf-turnstile-response': (form.querySelector('[name=cf-turnstile-response]') || {}).value || '',
      };
      try {
        const d = await api('/api/removal-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (d && d.ok) setMain(el('div', { class: 'container form-wrap' }, [el('div', { class: 'alert alert-ok', text: t('removal.ok') })]));
        else throw new Error(d.error || 'err');
      } catch (err) {
        const key = err.message === 'turnstile_failed' ? 'form.errTurnstile' : 'form.errGeneric';
        msg.appendChild(el('div', { class: 'alert alert-err', text: t(key) }));
        if (window.turnstile) try { window.turnstile.reset(); } catch {}
      }
    });
  }

  function view404() {
    setMeta('404 — AlbaBiz.ie');
    setMain(el('div', { class: 'container' }, [statePane('circle-dot', '404',
      t('results.noneHint'),
      el('a', { class: 'btn btn-primary', href: '/', 'data-link': '', style: 'margin-top:8px', text: t('nav.home') }))]));
  }

  // ---- Turnstile loader ---------------------------------------------------
  let tsLoaded = false;
  function loadTurnstile() {
    if (tsLoaded) { if (window.turnstile) try { window.turnstile.render('.cf-turnstile'); } catch {} return; }
    tsLoaded = true;
    const s = el('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js', async: '', defer: '' });
    document.head.appendChild(s);
  }

  // =========================================================================
  // Router
  // =========================================================================
  function route() {
    const path = location.pathname;
    const params = new URLSearchParams(location.search);
    track('page_view', { path: path });
    let m;
    if (path === '/' || path === '/index.html') return viewHome(params);
    if ((m = path.match(/^\/biznes\/([a-z0-9-]+)\/?$/))) return viewBusiness(m[1]);
    if ((m = path.match(/^\/kategoria\/([a-z0-9-]+)\/?$/))) return viewCategory(m[1]);
    if ((m = path.match(/^\/kontea\/([a-z0-9-]+)\/?$/))) return viewCounty(m[1]);
    if (path === '/regjistro') return viewSubmit();
    if (path === '/hiq') return viewRemoval(params);
    return view404();
  }

  // Intercept internal link clicks for SPA nav.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http')) return;
    e.preventDefault();
    if (href !== location.pathname + location.search) { history.pushState({}, '', href); route(); }
  });
  window.addEventListener('popstate', route);

  // Language toggle wiring + re-render on change.
  function syncLangButtons() {
    document.querySelectorAll('.lang-toggle button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === window.I18N.lang)));
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.getAttribute('data-i18n')); });
  }
  document.querySelectorAll('.lang-toggle button').forEach((b) =>
    b.addEventListener('click', () => { window.I18N.set(b.getAttribute('data-lang')); }));
  window.addEventListener('langchange', () => { syncLangButtons(); route(); });

  // Expose a back hook for the Android shell (window.albabizOnBack()).
  window.albabizOnBack = function () {
    if (location.pathname !== '/' || location.search) { history.back(); return true; }
    return false; // let the app handle (exit)
  };

  // Boot
  if (!API || API.includes('YOUR-SUBDOMAIN')) {
    setMain(el('div', { class: 'container' }, [el('div', { class: 'alert alert-err', style: 'margin-top:40px',
      html: '⚠️ <strong>Config needed:</strong> set <code>API_BASE</code> in <code>/config.js</code> to your deployed Worker URL.' })]));
  } else {
    syncLangButtons();
    route();
  }
})();
