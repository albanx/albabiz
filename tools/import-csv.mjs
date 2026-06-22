#!/usr/bin/env node
/*
 * AlbaBiz.ie — Google Form CSV → D1 importer.
 *
 * Reads a CSV export of existing Google Form responses and emits an SQL file
 * that inserts each row into the `businesses` table as status='pending'
 * (source='import'), plus the category links. You then apply it with wrangler:
 *
 *   node tools/import-csv.mjs responses.csv > import.sql
 *   wrangler d1 execute albabiz-db --remote --file=import.sql   # from cloud/worker
 *
 * Column mapping is driven by COLMAP below — Google Form headers vary, so edit
 * the right-hand patterns to match YOUR sheet's exact column titles (case-
 * insensitive substring match). Run with --print-headers to see what it found:
 *
 *   node tools/import-csv.mjs responses.csv --print-headers
 *
 * Categories: the CSV's category text is matched against the seeded category
 * slugs/names (see CATEGORY_ALIASES). Unmatched categories are reported on
 * stderr and skipped (the business still imports, just without that link).
 *
 * No external deps — a small dependency-free CSV parser handles quoted fields,
 * embedded commas and newlines.
 */

import { readFileSync } from 'node:fs';

// ---- 1. Map your Google Form columns here (case-insensitive substring) -----
const COLMAP = {
  name:            ['business name', 'emri i biznesit', 'name of business'],
  owner_name:      ['your name', 'contact name', 'owner', 'emri juaj'],
  description_en:  ['description (english)', 'description en', 'about (english)', 'description'],
  description_sq:  ['description (albanian)', 'pershkrim', 'përshkrim', 'description sq'],
  category:        ['category', 'categories', 'kategoria', 'kategori'],
  county:          ['county', 'qarku'],
  town:            ['town', 'city', 'qyteti', 'vendi'],
  address:         ['address', 'adresa'],
  phone:           ['phone', 'telefon', 'mobile', 'tel'],
  whatsapp:        ['whatsapp'],
  email:           ['email', 'e-mail'],
  website:         ['website', 'web', 'faqja'],
  facebook:        ['facebook', 'fb'],
  instagram:       ['instagram', 'insta', 'ig'],
  linkedin:        ['linkedin'],
  year_established:['year established', 'year', 'viti'],
};

// ---- 2. Category text → seeded slug. Extend as needed. ---------------------
const CATEGORY_ALIASES = {
  'construction-trades':  ['construction', 'trades', 'ndertim', 'ndërtim', 'builder', 'plumb', 'electric'],
  'automotive-car-sales': ['automotive', 'car sales', 'makina', 'auto', 'garage'],
  'car-wash-valeting':    ['car wash', 'valet', 'larje'],
  'food-restaurants':     ['restaurant', 'food', 'restorant', 'cafe', 'takeaway', 'pizz'],
  'food-retail-grocery':  ['grocery', 'market', 'supermarket', 'ushqimore', 'shop food'],
  'beauty-barber':        ['beauty', 'barber', 'hair', 'berber', 'sallon', 'salon', 'nails'],
  'cleaning-services':    ['cleaning', 'pastrim', 'cleaner'],
  'professional-services':['legal', 'account', 'consult', 'solicitor', 'tax', 'profesional'],
  'real-estate':          ['real estate', 'property', 'patundshme', 'prona', 'letting'],
  'health-wellness':      ['health', 'wellness', 'dental', 'physio', 'shendet', 'shëndet', 'pharma'],
  'education-language':   ['education', 'language', 'school', 'tutor', 'edukim', 'gjuhe', 'gjuhë'],
  'transport-logistics':  ['transport', 'logistic', 'courier', 'haulage', 'moving', 'transport'],
  'retail':               ['retail', 'shop', 'store', 'tregti', 'clothing', 'boutique'],
  'it-digital':           ['it ', 'digital', 'software', 'web design', 'marketing', 'tech'],
  'other':                ['other', 'tjeter', 'tjetër'],
};

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const printHeaders = args.includes('--print-headers');
if (!file) {
  console.error('Usage: node tools/import-csv.mjs <responses.csv> [--print-headers] > import.sql');
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');
const rows = parseCsv(raw);
if (!rows.length) { console.error('Empty CSV.'); process.exit(1); }
const headers = rows[0];
const dataRows = rows.slice(1);

// Resolve each logical field to a column index.
const idx = {};
for (const [field, patterns] of Object.entries(COLMAP)) {
  idx[field] = headers.findIndex((h) =>
    patterns.some((p) => h.toLowerCase().includes(p.toLowerCase())));
}

if (printHeaders) {
  console.error('Detected headers:\n' + headers.map((h, i) => `  [${i}] ${h}`).join('\n'));
  console.error('\nField → column resolution:');
  for (const f of Object.keys(COLMAP)) {
    console.error(`  ${f.padEnd(16)} -> ${idx[f] >= 0 ? `[${idx[f]}] "${headers[idx[f]]}"` : '(not found)'}`);
  }
  process.exit(0);
}
if (idx.name < 0) {
  console.error('ERROR: could not find a "business name" column. Run with --print-headers and edit COLMAP.');
  process.exit(1);
}

const sqlEsc = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const cell = (r, field) => (idx[field] >= 0 ? (r[idx[field]] || '').trim() : '') || null;
const nowExpr = 'CAST(strftime(\'%s\',\'now\') AS INTEGER)*1000';

const out = [];
out.push('-- AlbaBiz.ie — imported Google Form responses (status=pending, source=import).');
out.push('-- Generated by tools/import-csv.mjs. Review before applying.');
out.push('BEGIN TRANSACTION;');

let imported = 0;
const unmatchedCats = new Set();

dataRows.forEach((r, i) => {
  const name = cell(r, 'name');
  if (!name) return; // skip blank rows

  const county = cell(r, 'county');
  const yearStr = cell(r, 'year_established');
  const year = yearStr && /^\d{4}$/.test(yearStr) ? parseInt(yearStr, 10) : null;

  // County lookup is done in SQL via a subquery on slug OR case-insensitive name.
  const countyExpr = county
    ? `(SELECT id FROM counties WHERE slug = lower(${sqlEsc(county)}) OR lower(name_en) = lower(${sqlEsc(county)}) LIMIT 1)`
    : 'NULL';

  out.push(
    `INSERT INTO businesses (status, name, owner_name, description_sq, description_en, county_id, town, address, ` +
    `phone, whatsapp, email, website, facebook, instagram, linkedin, year_established, show_contact, ` +
    `gdpr_consent, gdpr_consent_at, source, created_at, updated_at) VALUES (` +
    `'pending', ${sqlEsc(name)}, ${sqlEsc(cell(r,'owner_name'))}, ${sqlEsc(cell(r,'description_sq'))}, ` +
    `${sqlEsc(cell(r,'description_en'))}, ${countyExpr}, ${sqlEsc(cell(r,'town'))}, ${sqlEsc(cell(r,'address'))}, ` +
    `${sqlEsc(cell(r,'phone'))}, ${sqlEsc(cell(r,'whatsapp'))}, ${sqlEsc(cell(r,'email'))}, ${sqlEsc(cell(r,'website'))}, ` +
    `${sqlEsc(cell(r,'facebook'))}, ${sqlEsc(cell(r,'instagram'))}, ${sqlEsc(cell(r,'linkedin'))}, ` +
    `${year == null ? 'NULL' : year}, 1, ` +
    // Imported rows: GDPR consent is NOT assumed. They start unconsented; the
    // admin must confirm consent (e.g. the Form itself had a consent question)
    // before approving. Set to 1 here ONLY if your Form captured explicit consent.
    `0, NULL, 'import', ${nowExpr}, ${nowExpr});`
  );

  // Category links (best-effort match against seeded slugs).
  const catText = (cell(r, 'category') || '').toLowerCase();
  if (catText) {
    const matched = matchCategories(catText);
    if (!matched.length) unmatchedCats.add(catText);
    for (const slug of matched) {
      out.push(
        `INSERT OR IGNORE INTO business_categories (business_id, category_id) ` +
        `SELECT last_insert_rowid(), id FROM categories WHERE slug = '${slug}';`
      );
    }
  }
  imported++;
});

out.push('COMMIT;');
process.stdout.write(out.join('\n') + '\n');

console.error(`\n✓ Generated SQL for ${imported} business row(s).`);
if (unmatchedCats.size) {
  console.error(`⚠ ${unmatchedCats.size} category value(s) had no match (business still imported, no category link):`);
  [...unmatchedCats].slice(0, 20).forEach((c) => console.error(`   - "${c}"`));
  console.error('  Extend CATEGORY_ALIASES in this script to cover them.');
}
console.error('\nNext: review the SQL, then from cloud/worker run:');
console.error('  wrangler d1 execute albabiz-db --remote --file=../../import.sql');

// ---------------------------------------------------------------------------
function matchCategories(text) {
  const hits = [];
  for (const [slug, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => text.includes(a.toLowerCase()))) hits.push(slug);
  }
  return [...new Set(hits)];
}

/** Minimal RFC-4180-ish CSV parser: handles quotes, "" escapes, CR/LF, commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignore, handle on \n */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  // Drop a trailing empty row if the file ended with a newline.
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}
