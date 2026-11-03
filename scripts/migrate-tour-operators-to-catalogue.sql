-- =============================================================================
-- migrate-tour-operators-to-catalogue.sql
--
-- Turns the per-organisation copies in tour_operator_table into ONE platform-wide
-- catalogue plus one org_tour_operator link per organisation.
--
--   * merges copies by lower(btrim(name)); canonical row = has a logo, then the
--     global seed row (org_id IS NULL), then the lowest id (the table has no
--     timestamp, so "oldest" cannot be computed)
--   * creates org_tour_operator (CREATE TABLE IF NOT EXISTS, same as Drizzle)
--   * one link per (org_id, canonical) carrying the first non-null commission
--   * repoints ALL 20 foreign-key columns from duplicate ids to the canonical id
--   * adds INACTIVE links for operators an org's quotes/bookings use but never owned
--   * deletes the duplicates, trims names, sets org_id NULL on the survivors
--
-- RUN ORDER (do not skip a step, do not reorder):
--   1. Stop the app (old code must not run against a migrated database, and the
--      new code must not run before the migration in step 6).
--   2. npm run db:migrate-tour-operators -- --dry-run
--        (runs ONLY the "DRY RUN" section below through the app's pg pool; psql is
--        not needed — or: psql -v ON_ERROR_STOP=1 -f <this file>). Review it.
--   3. npm run db:migrate-tour-operators
--        Runs this whole script ONCE against the OLD schema. It is one transaction:
--        any failure rolls everything back.
--   4. npm run db:migrate
--        migrations/0061_confused_puma.sql is already generated and was made
--        idempotent for org_tour_operator (CREATE TABLE IF NOT EXISTS, FKs wrapped
--        in duplicate_object handlers, CREATE INDEX IF NOT EXISTS), so it runs
--        cleanly after this script. If you ever regenerate it, re-apply that.
--   5. Start the new code.
--   Running db:migrate BEFORE step 3 fails on uq_tour_operator_name_lower
--   ("Key (lower(name))=(…) is duplicated") and rolls back — harmless; do step 3.
--
-- Logos: when copies are merged only the canonical row survives, so a logo that
-- sits on a non-canonical copy is dropped (the canonical row is chosen to have a
-- logo whenever any copy in the group has one).
--
-- Re-running: BEFORE step 6 the script is safe to run again (every step becomes a
-- no-op). AFTER step 6 the guard below aborts with 'Already migrated' and changes
-- nothing.
--
-- UPDATE statements that repoint foreign keys: 20 (quote_table, 8 quote line
-- tables, booking_table, 8 booking line tables, booking_upsell, supplier_scraper).
-- =============================================================================


-- =============================================================================
-- DRY RUN  (read-only; run on its own first and review the output)
-- =============================================================================

-- 0a. Duplicate groups that WILL be merged.
WITH keyed AS (
  SELECT id, org_id, name, logo_url, commission_percentage,
         lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) AS k
  FROM tour_operator_table
  WHERE nullif(btrim(name), '') IS NOT NULL
),
ranked AS (
  SELECT id AS old_id, org_id, commission_percentage, k,
         first_value(id) OVER (PARTITION BY k ORDER BY (logo_url IS NOT NULL) DESC, (org_id IS NULL) DESC, id) AS canonical_id,
         count(*) OVER (PARTITION BY k) AS copies
  FROM keyed
)
SELECT k AS name_key, copies, canonical_id, array_agg(old_id) FILTER (WHERE old_id <> canonical_id) AS merged_ids
FROM ranked
WHERE copies > 1
GROUP BY k, copies, canonical_id
ORDER BY copies DESC, k;

-- 0b. Rows with a blank/NULL name (will be renamed 'Unnamed operator <id8>').
SELECT id, org_id, name FROM tour_operator_table WHERE nullif(btrim(name), '') IS NULL;

-- 0c. Rows in each of the 20 FK columns that will be repointed to a canonical id.
WITH keyed AS (
  SELECT id, org_id, name, logo_url, commission_percentage,
         lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) AS k
  FROM tour_operator_table
  WHERE nullif(btrim(name), '') IS NOT NULL
),
ranked AS (
  SELECT id AS old_id, org_id, commission_percentage, k,
         first_value(id) OVER (PARTITION BY k ORDER BY (logo_url IS NOT NULL) DESC, (org_id IS NULL) DESC, id) AS canonical_id,
         count(*) OVER (PARTITION BY k) AS copies
  FROM keyed
),
dup AS (SELECT old_id FROM ranked WHERE old_id <> canonical_id)
SELECT 'quote_table.main_tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_table WHERE main_tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_flights.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_flights WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_accomodation.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_accomodation WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_transfers.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_transfers WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_car_hire.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_car_hire WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_attraction_ticket.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_attraction_ticket WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_lounge_pass.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_lounge_pass WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_airport_parking.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_airport_parking WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'quote_cruise.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM quote_cruise WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_table.main_tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_table WHERE main_tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_flights.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_flights WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_accomodation.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_accomodation WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_transfers.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_transfers WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_car_hire.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_car_hire WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_attraction_ticket.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_attraction_ticket WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_lounge_pass.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_lounge_pass WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_airport_parking.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_airport_parking WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_cruise.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_cruise WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'booking_upsell.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM booking_upsell WHERE tour_operator_id IN (SELECT old_id FROM dup)
UNION ALL
SELECT 'supplier_scraper.tour_operator_id' AS fk_column, count(*) AS rows_to_repoint FROM supplier_scraper WHERE tour_operator_id IN (SELECT old_id FROM dup);

-- 0d. Links that will be created for owned operators, per organisation.
WITH keyed AS (
  SELECT id, org_id, name, logo_url, commission_percentage,
         lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) AS k
  FROM tour_operator_table
  WHERE nullif(btrim(name), '') IS NOT NULL
),
ranked AS (
  SELECT id AS old_id, org_id, commission_percentage, k,
         first_value(id) OVER (PARTITION BY k ORDER BY (logo_url IS NOT NULL) DESC, (org_id IS NULL) DESC, id) AS canonical_id,
         count(*) OVER (PARTITION BY k) AS copies
  FROM keyed
)
SELECT org_id, count(DISTINCT canonical_id) AS links,
       count(DISTINCT canonical_id) FILTER (WHERE commission_percentage IS NOT NULL) AS with_commission
FROM ranked
WHERE org_id IS NOT NULL
GROUP BY org_id
ORDER BY links DESC;

-- 0e. Operators an organisation's quotes/bookings reference but the org never owned
--     (these get an INACTIVE link so existing records keep working).
--     Blank-name operators (see 0b) are renamed 'Unnamed operator ...' first in the
--     migration, so they are not counted here but are handled by the real run.
WITH keyed AS (
  SELECT id, org_id, name, logo_url, commission_percentage,
         lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) AS k
  FROM tour_operator_table
  WHERE nullif(btrim(name), '') IS NOT NULL
),
ranked AS (
  SELECT id AS old_id, org_id, commission_percentage, k,
         first_value(id) OVER (PARTITION BY k ORDER BY (logo_url IS NOT NULL) DESC, (org_id IS NULL) DESC, id) AS canonical_id,
         count(*) OVER (PARTITION BY k) AS copies
  FROM keyed
),
owned AS (SELECT DISTINCT org_id, canonical_id AS operator_id FROM ranked WHERE org_id IS NOT NULL),
used AS (
  SELECT DISTINCT r.org_id, m.canonical_id AS operator_id
  FROM (
    SELECT tr.org_id, x.main_tour_operator_id AS operator_id FROM quote_table x JOIN "transaction" tr ON tr.id = x.transaction_id WHERE x.main_tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_flights x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_accomodation x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_transfers x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_car_hire x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_attraction_ticket x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_lounge_pass x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_airport_parking x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_cruise x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.main_tour_operator_id AS operator_id FROM booking_table x JOIN "transaction" tr ON tr.id = x.transaction_id WHERE x.main_tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_flights x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_accomodation x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_transfers x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_car_hire x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_attraction_ticket x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_lounge_pass x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_airport_parking x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_cruise x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_upsell x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
  ) r
  JOIN ranked m ON m.old_id = r.operator_id
)
SELECT u.org_id, count(*) AS unowned_pairs
FROM used u
WHERE NOT EXISTS (SELECT 1 FROM owned o WHERE o.org_id = u.org_id AND o.operator_id = u.operator_id)
GROUP BY u.org_id
ORDER BY unowned_pairs DESC;


-- =============================================================================
-- MIGRATION  (one transaction)
-- =============================================================================
BEGIN;

-- Guard: stop if tour_operator_table has already been migrated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tour_operator_table' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'Already migrated - nothing to do';
  END IF;
END $$;

-- Create the link table exactly as shared/schema.ts defines it (idempotent).
CREATE TABLE IF NOT EXISTS "org_tour_operator" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL,
  "tour_operator_id" uuid NOT NULL,
  "commission_percentage" numeric(5, 2),
  "balance_due_weeks" integer DEFAULT 14 NOT NULL,
  "username" varchar,
  "encrypted_password" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "org_tour_operator" ADD CONSTRAINT "org_tour_operator_org_id_organization_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "org_tour_operator" ADD CONSTRAINT "org_tour_operator_tour_operator_id_tour_operator_table_id_fk"
    FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "org_tour_operator" ADD CONSTRAINT "org_tour_operator_created_by_user_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_tour_operator_org_operator" ON "org_tour_operator" USING btree ("org_id","tour_operator_id");
CREATE INDEX IF NOT EXISTS "idx_org_tour_operator_operator" ON "org_tour_operator" USING btree ("tour_operator_id");

-- Safety: the 20 columns below must be EVERY foreign key into tour_operator_table
-- (apart from the new link table). A different count means this script is stale.
DO $$
DECLARE fk_count integer;
BEGIN
  SELECT count(*) INTO fk_count
  FROM pg_constraint
  WHERE contype = 'f'
    AND confrelid = 'tour_operator_table'::regclass
    AND conrelid <> 'org_tour_operator'::regclass;
  IF fk_count <> 20 THEN
    RAISE EXCEPTION 'Expected 20 foreign keys into tour_operator_table, found % - script is out of date', fk_count;
  END IF;
END $$;

-- Blank / NULL names would break the generated NOT NULL and the name-merge.
UPDATE tour_operator_table
SET name = 'Unnamed operator ' || left(id::text, 8)
WHERE nullif(btrim(name), '') IS NULL;

-- Merge map: every row maps to its canonical row (canonical rows map to themselves).
CREATE TEMP TABLE _op_merge ON COMMIT DROP AS
WITH keyed AS (
  SELECT id, org_id, logo_url, commission_percentage,
         lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) AS k
  FROM tour_operator_table
)
SELECT id AS old_id,
       org_id,
       commission_percentage,
       first_value(id) OVER (PARTITION BY k ORDER BY (logo_url IS NOT NULL) DESC, (org_id IS NULL) DESC, id) AS canonical_id
FROM keyed;
CREATE INDEX ON _op_merge (old_id);

-- One link per (org, canonical operator); first non-null commission wins.
INSERT INTO org_tour_operator (org_id, tour_operator_id, commission_percentage)
SELECT org_id, canonical_id,
       (array_agg(commission_percentage ORDER BY (commission_percentage IS NULL), old_id))[1]
FROM _op_merge
WHERE org_id IS NOT NULL
GROUP BY org_id, canonical_id
ON CONFLICT (org_id, tour_operator_id) DO NOTHING;

-- Repoint every foreign key from duplicate ids to the canonical id (20 UPDATEs).
-- A missed column would make the duplicate DELETE below fail (or silently NULL
-- booking_upsell / supplier_scraper), so keep all 20.
-- (1/20)
UPDATE quote_table t SET main_tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.main_tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (2/20)
UPDATE quote_flights t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (3/20)
UPDATE quote_accomodation t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (4/20)
UPDATE quote_transfers t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (5/20)
UPDATE quote_car_hire t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (6/20)
UPDATE quote_attraction_ticket t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (7/20)
UPDATE quote_lounge_pass t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (8/20)
UPDATE quote_airport_parking t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (9/20)
UPDATE quote_cruise t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (10/20)
UPDATE booking_table t SET main_tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.main_tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (11/20)
UPDATE booking_flights t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (12/20)
UPDATE booking_accomodation t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (13/20)
UPDATE booking_transfers t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (14/20)
UPDATE booking_car_hire t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (15/20)
UPDATE booking_attraction_ticket t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (16/20)
UPDATE booking_lounge_pass t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (17/20)
UPDATE booking_airport_parking t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (18/20)
UPDATE booking_cruise t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (19/20)
UPDATE booking_upsell t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;
-- (20/20)
UPDATE supplier_scraper t SET tour_operator_id = m.canonical_id FROM _op_merge m WHERE t.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;

-- Operators referenced by an org's records but never owned by it: add INACTIVE links
-- so existing quotes/bookings keep their operator and the org can still see them.
INSERT INTO org_tour_operator (org_id, tour_operator_id, is_active)
SELECT DISTINCT r.org_id, r.operator_id, false
FROM (
    SELECT tr.org_id, x.main_tour_operator_id AS operator_id FROM quote_table x JOIN "transaction" tr ON tr.id = x.transaction_id WHERE x.main_tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_flights x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_accomodation x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_transfers x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_car_hire x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_attraction_ticket x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_lounge_pass x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_airport_parking x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM quote_cruise x JOIN quote_table q ON q.id = x.quote_id JOIN "transaction" tr ON tr.id = q.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.main_tour_operator_id AS operator_id FROM booking_table x JOIN "transaction" tr ON tr.id = x.transaction_id WHERE x.main_tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_flights x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_accomodation x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_transfers x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_car_hire x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_attraction_ticket x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_lounge_pass x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_airport_parking x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_cruise x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
    UNION
    SELECT tr.org_id, x.tour_operator_id AS operator_id FROM booking_upsell x JOIN booking_table b ON b.id = x.booking_id JOIN "transaction" tr ON tr.id = b.transaction_id WHERE x.tour_operator_id IS NOT NULL AND tr.org_id IS NOT NULL
) r
ON CONFLICT (org_id, tour_operator_id) DO NOTHING;

-- Links that already point at a duplicate (only possible on a re-run after a
-- partial earlier run): move them to the canonical row. When the org already
-- has a canonical link, keep it, fill a missing commission from the duplicate's
-- link, and drop the duplicate's link (the cascade would drop it anyway).
UPDATE org_tour_operator c
SET commission_percentage = l.commission_percentage
FROM org_tour_operator l
JOIN _op_merge m ON m.old_id = l.tour_operator_id AND m.old_id <> m.canonical_id
WHERE c.org_id = l.org_id AND c.tour_operator_id = m.canonical_id
  AND c.commission_percentage IS NULL AND l.commission_percentage IS NOT NULL;
UPDATE org_tour_operator l
SET tour_operator_id = m.canonical_id
FROM _op_merge m
WHERE l.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id
  AND NOT EXISTS (SELECT 1 FROM org_tour_operator c WHERE c.org_id = l.org_id AND c.tour_operator_id = m.canonical_id);
DELETE FROM org_tour_operator l
USING _op_merge m
WHERE l.tour_operator_id = m.old_id AND m.old_id <> m.canonical_id;

-- Remove the duplicates (nothing references them any more).
DELETE FROM tour_operator_table t
USING _op_merge m
WHERE t.id = m.old_id AND m.old_id <> m.canonical_id;

-- Clean the survivors: trimmed, single-spaced names; no owning org.
UPDATE tour_operator_table
SET name = regexp_replace(btrim(name), '\s+', ' ', 'g')
WHERE name <> regexp_replace(btrim(name), '\s+', ' ', 'g');
UPDATE tour_operator_table SET org_id = NULL WHERE org_id IS NOT NULL;

-- Post-checks: any failure rolls the whole transaction back.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT lower(name) FROM tour_operator_table GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF n > 0 THEN RAISE EXCEPTION 'Post-check failed: % duplicate names remain', n; END IF;

  SELECT count(*) INTO n FROM tour_operator_table WHERE nullif(btrim(name), '') IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'Post-check failed: % blank names remain', n; END IF;

  SELECT count(*) INTO n FROM tour_operator_table WHERE org_id IS NOT NULL;
  IF n > 0 THEN RAISE EXCEPTION 'Post-check failed: % rows still have an org_id', n; END IF;
END $$;

COMMIT;
