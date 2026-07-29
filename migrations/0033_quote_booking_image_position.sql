ALTER TABLE "booking_images" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_images" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- One-time backfill so existing galleries keep the order they appear in today.
-- Without it every row sits at 0, ordering falls back to the `id` tiebreak, and
-- because `id` is a random UUID every existing quote/booking gallery would
-- visibly reshuffle the moment this ships.
--
-- `ctid` is the physical row location, which for these append-only image tables
-- tracks insertion order closely enough to reproduce what the current unordered
-- SELECT returns. It's only a starting point — the first drag-to-reorder
-- replaces these values with real ones.
UPDATE "quote_images" AS qi
SET "position" = ordered.rn
FROM (
  SELECT ctid, (row_number() OVER (PARTITION BY "quote_id" ORDER BY ctid) - 1) AS rn
  FROM "quote_images"
) AS ordered
WHERE qi.ctid = ordered.ctid;--> statement-breakpoint

UPDATE "booking_images" AS bi
SET "position" = ordered.rn
FROM (
  SELECT ctid, (row_number() OVER (PARTITION BY "booking_id" ORDER BY ctid) - 1) AS rn
  FROM "booking_images"
) AS ordered
WHERE bi.ctid = ordered.ctid;
