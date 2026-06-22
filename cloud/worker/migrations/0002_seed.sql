-- AlbaBiz.ie — seed data: 26 Republic of Ireland counties + the starter
-- category set (bilingual sq/en). Safe to re-run: uses INSERT OR IGNORE keyed
-- on the unique slug.
--
-- Apply after 0001_init.sql:
--   npx wrangler d1 execute albabiz-db --remote --file=migrations/0002_seed.sql

-- ---- Counties (alphabetical; sort_order matches) -------------------------
INSERT OR IGNORE INTO counties (slug, name_en, name_sq, sort_order) VALUES
  ('carlow',    'Carlow',    'Carlow',    1),
  ('cavan',     'Cavan',     'Cavan',     2),
  ('clare',     'Clare',     'Clare',     3),
  ('cork',      'Cork',      'Cork',      4),
  ('donegal',   'Donegal',   'Donegal',   5),
  ('dublin',    'Dublin',    'Dublin',    6),
  ('galway',    'Galway',    'Galway',    7),
  ('kerry',     'Kerry',     'Kerry',     8),
  ('kildare',   'Kildare',   'Kildare',   9),
  ('kilkenny',  'Kilkenny',  'Kilkenny',  10),
  ('laois',     'Laois',     'Laois',     11),
  ('leitrim',   'Leitrim',   'Leitrim',   12),
  ('limerick',  'Limerick',  'Limerick',  13),
  ('longford',  'Longford',  'Longford',  14),
  ('louth',     'Louth',     'Louth',     15),
  ('mayo',      'Mayo',      'Mayo',      16),
  ('meath',     'Meath',     'Meath',     17),
  ('monaghan',  'Monaghan',  'Monaghan',  18),
  ('offaly',    'Offaly',    'Offaly',    19),
  ('roscommon', 'Roscommon', 'Roscommon', 20),
  ('sligo',     'Sligo',     'Sligo',     21),
  ('tipperary', 'Tipperary', 'Tipperary', 22),
  ('waterford', 'Waterford', 'Waterford', 23),
  ('westmeath', 'Westmeath', 'Westmeath', 24),
  ('wexford',   'Wexford',   'Wexford',   25),
  ('wicklow',   'Wicklow',   'Wicklow',   26);

-- ---- Categories (Irish-Albanian business mix) ----------------------------
INSERT OR IGNORE INTO categories (slug, name_en, name_sq, icon, sort_order) VALUES
  ('construction-trades',  'Construction & Trades',       'Ndërtim & Zanate',              '🔨', 1),
  ('automotive-car-sales', 'Automotive & Car Sales',      'Automjete & Shitje Makinash',   '🚗', 2),
  ('car-wash-valeting',    'Car Wash & Valeting',         'Larje & Pastrim Makinash',      '🧼', 3),
  ('food-restaurants',     'Food & Restaurants',          'Ushqim & Restorante',           '🍽️', 4),
  ('food-retail-grocery',  'Food Retail / Grocery',       'Shitje Ushqimore / Market',     '🛒', 5),
  ('beauty-barber',        'Beauty & Barber',             'Bukuri & Berber',               '💈', 6),
  ('cleaning-services',    'Cleaning Services',           'Shërbime Pastrimi',             '🧹', 7),
  ('professional-services','Professional Services',       'Shërbime Profesionale',         '💼', 8),
  ('real-estate',          'Real Estate',                 'Patundshmëri / Prona',          '🏠', 9),
  ('health-wellness',      'Health & Wellness',           'Shëndet & Mirëqenie',           '🩺', 10),
  ('education-language',   'Education & Language',         'Edukim & Gjuhë',                '📚', 11),
  ('transport-logistics',  'Transport & Logistics',       'Transport & Logjistikë',        '🚚', 12),
  ('retail',               'Retail',                      'Tregti me Pakicë',              '🛍️', 13),
  ('it-digital',           'IT & Digital',                'IT & Dixhitale',                '💻', 14),
  ('other',                'Other',                       'Tjetër',                        '📌', 15);
