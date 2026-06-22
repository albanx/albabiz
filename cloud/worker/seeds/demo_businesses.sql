-- AlbaBiz.ie — DEMO businesses (for the redesign showcase + Play screenshots).
-- 8 realistic Albanian-owned businesses across Dublin / Cork / Galway, varied
-- categories, with map coordinates and two featured. All status='approved'.
--
-- Safe to re-run: keyed on the unique slug via INSERT OR IGNORE; category links
-- use INSERT OR IGNORE on the (business_id,category_id) PK. To remove later:
--   DELETE FROM businesses WHERE source='demo';   (cascades to business_categories)
--
-- Apply:
--   npx wrangler d1 execute albabiz-db --remote --file=seeds/demo_businesses.sql

-- ---------------------------------------------------------------------------
-- Businesses. county_id resolved by slug subquery; ts stamped by SQLite.
-- approved_by='seed' marks the moderator; source='demo' makes cleanup trivial.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO businesses
  (slug, status, is_featured, name, owner_name, description_sq, description_en,
   county_id, town, address, lat, lng, phone, whatsapp, email, website,
   facebook, instagram, year_established, show_contact, gdpr_consent,
   gdpr_consent_at, source, created_at, updated_at, approved_at, approved_by)
VALUES
  ('adriatik-construction', 'approved', 1,
   'Adriatik Construction',
   'Besnik Hoxha',
   'Ndërtim, zgjerime dhe rinovime shtëpish në zonën e Dublinit. Punë cilësore me ekip shqiptar.',
   'Construction, extensions and home renovations across Dublin. Quality work from an Albanian team.',
   (SELECT id FROM counties WHERE slug='dublin'), 'Swords', 'Main Street, Swords, Co. Dublin',
   53.4597, -6.2181, '+353 87 123 4567', '+353871234567', 'info@adriatik.ie', 'https://adriatik.ie',
   'https://facebook.com/adriatikconstruction', NULL, 2015, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed'),

  ('bukuria-beauty', 'approved', 0,
   'Bukuria Beauty Salon',
   'Mira Krasniqi',
   'Sallon bukurie për flokë, thonj dhe makijazh. Ekspertë me përvojë, çmime të arsyeshme.',
   'Beauty salon for hair, nails and make-up. Experienced stylists, fair prices.',
   (SELECT id FROM counties WHERE slug='dublin'), 'Blanchardstown', 'Blanchardstown Centre, Dublin 15',
   53.3906, -6.3766, '+353 85 765 4321', '+353857654321', 'hello@bukuria.ie', NULL,
   'https://facebook.com/bukuriabeauty', 'https://instagram.com/bukuria.beauty', 2019, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed'),

  ('pristina-grill', 'approved', 1,
   'Pristina Grill & Pizza',
   'Agon Berisha',
   'Kuzhinë ballkanike dhe pizza italiane. Qebapa, byrek dhe ëmbëlsira shtëpie. Hapur çdo ditë.',
   'Balkan cuisine and Italian pizza. Qebapa, byrek and homemade desserts. Open daily.',
   (SELECT id FROM counties WHERE slug='galway'), 'Galway', 'Shop Street, Galway',
   53.2719, -9.0529, '+353 91 234 567', '+353912345670', 'order@pristinagrill.ie', 'https://pristinagrill.ie',
   NULL, 'https://instagram.com/pristina.grill', 2018, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed'),

  ('dardania-motors', 'approved', 0,
   'Dardania Motors',
   'Fatmir Gashi',
   'Shitje dhe servis makinash. Inspektim NCT, gomistë dhe pjesë këmbimi. Besim dhe ndershmëri.',
   'Car sales and service. NCT prep, tyres and spare parts. Trusted and honest.',
   (SELECT id FROM counties WHERE slug='cork'), 'Cork', 'Kinsale Road, Cork',
   51.8869, -8.4863, '+353 21 456 7890', NULL, 'sales@dardaniamotors.ie', 'https://dardaniamotors.ie',
   'https://facebook.com/dardaniamotors', NULL, 2012, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed'),

  ('iliria-cleaning', 'approved', 0,
   'Iliria Cleaning Services',
   'Vjosa Dervishi',
   'Shërbime pastrimi për shtëpi dhe zyra. Pastrim i thellë, pas ndërtimit dhe i rregullt.',
   'Cleaning services for homes and offices. Deep, after-builders and regular cleans.',
   (SELECT id FROM counties WHERE slug='dublin'), 'Tallaght', 'The Square, Tallaght, Dublin 24',
   53.2859, -6.3733, '+353 89 987 6543', '+353899876543', 'book@iliriacleaning.ie', NULL,
   NULL, NULL, 2021, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed'),

  ('besa-accounting', 'approved', 0,
   'Besa Accounting',
   'Arben Leka',
   'Shërbime kontabiliteti dhe tatimore për biznese të vogla dhe individë. Konsulencë në shqip.',
   'Accounting and tax services for small businesses and individuals. Advice in Albanian.',
   (SELECT id FROM counties WHERE slug='dublin'), 'Dublin', 'Capel Street, Dublin 1',
   53.3478, -6.2672, '+353 1 234 5678', NULL, 'info@besaaccounting.ie', 'https://besaaccounting.ie',
   'https://facebook.com/besaaccounting', NULL, 2017, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed'),

  ('tirana-market', 'approved', 0,
   'Tirana Market',
   'Eduart Hoxha',
   'Market me produkte ballkanike: ajvar, djathë, mish dhe ëmbëlsira. Sjellim shijen e shtëpisë.',
   'Balkan grocery: ajvar, cheese, meats and sweets. A taste of home in Ireland.',
   (SELECT id FROM counties WHERE slug='cork'), 'Cork', 'MacCurtain Street, Cork',
   51.9024, -8.4699, '+353 21 987 6543', '+353219876543', NULL, NULL,
   'https://facebook.com/tiranamarket', 'https://instagram.com/tirana.market', 2020, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed'),

  ('arberia-digital', 'approved', 0,
   'Arbëria Digital',
   'Drita Shala',
   'Faqe interneti, marketing dixhital dhe dizajn për bizneset shqiptare në Irlandë.',
   'Websites, digital marketing and design for Albanian businesses in Ireland.',
   (SELECT id FROM counties WHERE slug='galway'), 'Galway', 'Eyre Square, Galway',
   53.2744, -9.0490, '+353 83 111 2222', '+353831112222', 'hello@arberiadigital.ie', 'https://arberiadigital.ie',
   NULL, 'https://instagram.com/arberia.digital', 2022, 1, 1,
   strftime('%s','now')*1000, 'demo', strftime('%s','now')*1000, strftime('%s','now')*1000, strftime('%s','now')*1000, 'seed');

-- ---------------------------------------------------------------------------
-- Category links (slug -> id, business slug -> id). INSERT OR IGNORE keeps it
-- re-runnable. A couple of businesses sit in two categories.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO business_categories (business_id, category_id)
SELECT b.id, c.id FROM businesses b, categories c WHERE
   (b.slug='adriatik-construction' AND c.slug='construction-trades')
OR (b.slug='bukuria-beauty'        AND c.slug='beauty-barber')
OR (b.slug='bukuria-beauty'        AND c.slug='health-wellness')
OR (b.slug='pristina-grill'        AND c.slug='food-restaurants')
OR (b.slug='dardania-motors'       AND c.slug='automotive-car-sales')
OR (b.slug='iliria-cleaning'       AND c.slug='cleaning-services')
OR (b.slug='besa-accounting'       AND c.slug='professional-services')
OR (b.slug='tirana-market'         AND c.slug='food-retail-grocery')
OR (b.slug='arberia-digital'       AND c.slug='it-digital');
