-- Clean-up of park / lodge records damaged by earlier Hoseasons imports.
--
-- UPDATE ONLY. This script deletes nothing and merges nothing: every park and
-- every lodge keeps its id, so quotes and bookings that point at them are
-- untouched. It only repairs text values on existing rows.
--
-- What it changes:
--   1. Park name / location / city and lodge name: raw HTML codes become plain
--      text ("Kitty&rsquo;s View" -> "Kitty's View", "&ndash;" -> "-").
--   2. Lodge codes that are really a piece of a web link
--      ("accommodationType=&siteId=CAWO&sort=…", "start=07-12-2026&nights=4")
--      are cleared. They were never lodge codes and can never match again.
--
-- What it deliberately leaves alone:
--   - duplicate or empty parks (e.g. "Kittys View Country Lodges", "The Paw Pad")
--   - parks named after a lodge (e.g. "Swallow Lodge", "Cawood Holiday Home 2")
--   - lodge codes saved as "Ref: LP8683"
--   - park descriptions
--
-- It runs in one transaction and prints the affected rows before and after.
-- To try it without saving anything, change the last line to ROLLBACK.

BEGIN;

-- Before: rows that will change.
SELECT 'park' AS kind, id, name AS value FROM park_table
 WHERE name ~ '&(rsquo|lsquo|ndash|amp);' OR location ~ '&(rsquo|lsquo|ndash|amp);' OR city ~ '&(rsquo|lsquo|ndash|amp);'
UNION ALL
SELECT 'lodge name', id, lodge_name FROM lodges_table WHERE lodge_name ~ '&(rsquo|lsquo|ndash|amp);'
UNION ALL
SELECT 'lodge code', id, lodge_code FROM lodges_table WHERE lodge_code LIKE '%=%'
ORDER BY 1, 3;

-- 1. HTML codes -> plain text.
UPDATE park_table
   SET name     = replace(replace(replace(replace(name,     '&rsquo;', ''''), '&lsquo;', ''''), '&ndash;', '-'), '&amp;', '&'),
       location = replace(replace(replace(replace(location, '&rsquo;', ''''), '&lsquo;', ''''), '&ndash;', '-'), '&amp;', '&'),
       city     = replace(replace(replace(replace(city,     '&rsquo;', ''''), '&lsquo;', ''''), '&ndash;', '-'), '&amp;', '&')
 WHERE name ~ '&(rsquo|lsquo|ndash|amp);' OR location ~ '&(rsquo|lsquo|ndash|amp);' OR city ~ '&(rsquo|lsquo|ndash|amp);';

UPDATE lodges_table
   SET lodge_name = replace(replace(replace(replace(lodge_name, '&rsquo;', ''''), '&lsquo;', ''''), '&ndash;', '-'), '&amp;', '&')
 WHERE lodge_name ~ '&(rsquo|lsquo|ndash|amp);';

-- 2. Link fragments saved as lodge codes -> empty. A real code never has "=".
UPDATE lodges_table
   SET lodge_code = NULL
 WHERE lodge_code LIKE '%=%';

-- After: both counts must be 0, and the row totals must match what you had.
SELECT
  (SELECT count(*) FROM park_table   WHERE name ~ '&(rsquo|lsquo|ndash|amp);')        AS parks_still_with_html,
  (SELECT count(*) FROM lodges_table WHERE lodge_name ~ '&(rsquo|lsquo|ndash|amp);')  AS lodges_still_with_html,
  (SELECT count(*) FROM lodges_table WHERE lodge_code LIKE '%=%')                     AS lodges_still_with_link_code,
  (SELECT count(*) FROM park_table)                                                    AS total_parks,
  (SELECT count(*) FROM lodges_table)                                                  AS total_lodges;

COMMIT;
