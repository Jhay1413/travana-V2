-- ============================================================
-- Phase 1: Quote-status pipeline refactor
-- Enum remap + new columns + data-integrity backfills
-- ============================================================

-- STEP 0: Capture WON quote ids BEFORE any enum remap, so we
-- can backfill booking.quote_id after the enum is replaced.
CREATE TEMP TABLE _won_quotes AS
SELECT DISTINCT ON (t.id)
  t.id          AS transaction_id,
  q.id          AS quote_id
FROM quote_table q
JOIN transaction t ON t.id = q.transaction_id
WHERE q.quote_status::text = 'WON'
  AND q.deleted_at IS NULL
ORDER BY t.id, q.date_created DESC NULLS LAST;

--> statement-breakpoint

-- ============================================================
-- STEP 1: Remap quote_status_enum
-- Old values → new values:
--   QUOTE_IN_PROGRESS, QUOTE_CALL, QUOTE_READY,
--   NEW_LEAD, REQUOTE, WON                        → quoted
--   AWAITING_DECISION                              → in_play
--   LOST                                           → lost
--   ARCHIVED, INACTIVE, EXPIRED                   → archived
-- (WON → quoted: these rows are already identified via
--  booking.quote_id backfill below; the WON → quoted mapping
--  is safe because transaction.status = on_booking keeps
--  them off the active board. See Phase 1 summary.)
-- ============================================================

-- 1a. Drop default so the column can be cast to text
ALTER TABLE "quote_table" ALTER COLUMN "quote_status" DROP DEFAULT;--> statement-breakpoint

-- 1b. Cast to text with the value remap
ALTER TABLE "quote_table" ALTER COLUMN "quote_status" TYPE text USING (
  CASE "quote_status"::text
    WHEN 'QUOTE_IN_PROGRESS' THEN 'quoted'
    WHEN 'QUOTE_CALL'        THEN 'quoted'
    WHEN 'QUOTE_READY'       THEN 'quoted'
    WHEN 'NEW_LEAD'          THEN 'quoted'
    WHEN 'REQUOTE'           THEN 'quoted'
    WHEN 'WON'               THEN 'quoted'
    WHEN 'AWAITING_DECISION' THEN 'in_play'
    WHEN 'LOST'              THEN 'lost'
    WHEN 'ARCHIVED'          THEN 'archived'
    WHEN 'INACTIVE'          THEN 'archived'
    WHEN 'EXPIRED'           THEN 'archived'
    ELSE                          'quoted'
  END
);--> statement-breakpoint

-- 1c. Rename old type out of the way
ALTER TYPE "public"."quote_status_enum" RENAME TO "quote_status_enum_old";--> statement-breakpoint

-- 1d. Create new type
CREATE TYPE "public"."quote_status_enum" AS ENUM('quoted', 'in_play', 'lost', 'archived');--> statement-breakpoint

-- 1e. Swap column back to the new enum
ALTER TABLE "quote_table" ALTER COLUMN "quote_status" TYPE "public"."quote_status_enum" USING "quote_status"::"public"."quote_status_enum";--> statement-breakpoint

-- 1f. Drop old type
DROP TYPE "public"."quote_status_enum_old";--> statement-breakpoint

-- ============================================================
-- STEP 2: Remap transaction_status_enum
-- Old values → new values:
--   in_play → on_quote
--   (on_enquiry, on_quote, on_booking unchanged)
-- ============================================================

-- 2a. Drop default so the column can be cast to text
ALTER TABLE "transaction" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint

-- 2b. Cast to text with the remap
ALTER TABLE "transaction" ALTER COLUMN "status" TYPE text USING (
  CASE "status"::text
    WHEN 'in_play' THEN 'on_quote'
    ELSE "status"::text
  END
);--> statement-breakpoint

-- 2c. Rename old type
ALTER TYPE "public"."transaction_status_enum" RENAME TO "transaction_status_enum_old";--> statement-breakpoint

-- 2d. Create new type
CREATE TYPE "public"."transaction_status_enum" AS ENUM('on_enquiry', 'on_quote', 'on_booking');--> statement-breakpoint

-- 2e. Swap column back to the new enum
ALTER TABLE "transaction" ALTER COLUMN "status" TYPE "public"."transaction_status_enum" USING "status"::"public"."transaction_status_enum";--> statement-breakpoint

-- 2f. Drop old type
DROP TYPE "public"."transaction_status_enum_old";--> statement-breakpoint

-- ============================================================
-- STEP 3: Add new columns
-- ============================================================

ALTER TABLE "booking_table" ADD COLUMN "quote_id" uuid;--> statement-breakpoint
ALTER TABLE "quote_table" ADD COLUMN "parent_quote_id" uuid;--> statement-breakpoint

ALTER TABLE "booking_table"
  ADD CONSTRAINT "booking_table_quote_id_quote_table_id_fk"
  FOREIGN KEY ("quote_id")
  REFERENCES "public"."quote_table"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "quote_table"
  ADD CONSTRAINT "quote_table_parent_quote_id_quote_table_id_fk"
  FOREIGN KEY ("parent_quote_id")
  REFERENCES "public"."quote_table"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- ============================================================
-- STEP 4: Backfill booking.quote_id from the WON capture
-- ============================================================

UPDATE booking_table b
SET quote_id = w.quote_id
FROM _won_quotes w
WHERE b.transaction_id = w.transaction_id
  AND b.quote_id IS NULL;--> statement-breakpoint

-- ============================================================
-- STEP 5: isQuoteCopy integrity backfill
-- Invariant: exactly one isQuoteCopy = false per transaction.
-- Only considers non-free (isFreeQuote = false) and
-- non-deleted (deleted_at IS NULL) quotes.
--
-- 5a. Fix transactions with MORE THAN ONE isQuoteCopy = false:
--     keep the most recent, set the rest to true.
-- 5b. Fix transactions with ZERO isQuoteCopy = false:
--     promote the most-recent non-lost quote.
-- ============================================================

-- 5a. Demote all but the most recent primary where duplicates exist
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY transaction_id
      ORDER BY date_created DESC NULLS LAST
    ) AS rn
  FROM quote_table
  WHERE "isQuoteCopy" = false
    AND "isFreeQuote" = false
    AND deleted_at IS NULL
),
extras AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE quote_table
SET "isQuoteCopy" = true
WHERE id IN (SELECT id FROM extras);--> statement-breakpoint

-- 5b. Promote the most-recent non-lost quote for transactions
--     that still have no primary after step 5a
WITH tx_no_primary AS (
  SELECT DISTINCT transaction_id
  FROM quote_table
  WHERE "isFreeQuote" = false
    AND deleted_at IS NULL
  EXCEPT
  SELECT DISTINCT transaction_id
  FROM quote_table
  WHERE "isQuoteCopy" = false
    AND "isFreeQuote" = false
    AND deleted_at IS NULL
),
candidates AS (
  SELECT
    q.id,
    q.transaction_id,
    ROW_NUMBER() OVER (
      PARTITION BY q.transaction_id
      ORDER BY q.date_created DESC NULLS LAST
    ) AS rn
  FROM quote_table q
  JOIN tx_no_primary tp ON tp.transaction_id = q.transaction_id
  WHERE q."isFreeQuote" = false
    AND q.deleted_at IS NULL
    AND q.quote_status NOT IN ('lost','archived')
),
to_promote AS (
  SELECT id FROM candidates WHERE rn = 1
)
UPDATE quote_table
SET "isQuoteCopy" = false
WHERE id IN (SELECT id FROM to_promote);--> statement-breakpoint
