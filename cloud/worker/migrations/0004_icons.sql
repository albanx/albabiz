-- AlbaBiz.ie — swap seeded category emoji icons for Lucide icon keys, so the
-- DB `icon` column matches the front-end icon set (icons.js / CAT_ICON map).
-- The public UI maps category slug -> Lucide glyph itself, but keeping the DB
-- in sync means the admin "manage categories" view and any future API consumer
-- show the right icon name too.
--
-- Apply:
--   npx wrangler d1 execute albabiz-db --remote --file=migrations/0004_icons.sql

UPDATE categories SET icon='hard-hat'        WHERE slug='construction-trades';
UPDATE categories SET icon='car'             WHERE slug='automotive-car-sales';
UPDATE categories SET icon='droplets'        WHERE slug='car-wash-valeting';
UPDATE categories SET icon='utensils-crossed' WHERE slug='food-restaurants';
UPDATE categories SET icon='shopping-cart'   WHERE slug='food-retail-grocery';
UPDATE categories SET icon='scissors'        WHERE slug='beauty-barber';
UPDATE categories SET icon='spray-can'       WHERE slug='cleaning-services';
UPDATE categories SET icon='briefcase'       WHERE slug='professional-services';
UPDATE categories SET icon='home'            WHERE slug='real-estate';
UPDATE categories SET icon='heart-pulse'     WHERE slug='health-wellness';
UPDATE categories SET icon='graduation-cap'  WHERE slug='education-language';
UPDATE categories SET icon='truck'           WHERE slug='transport-logistics';
UPDATE categories SET icon='shopping-bag'    WHERE slug='retail';
UPDATE categories SET icon='monitor'         WHERE slug='it-digital';
UPDATE categories SET icon='circle-dot'      WHERE slug='other';
