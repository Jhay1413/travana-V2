ALTER TABLE "quote_table" ADD COLUMN IF NOT EXISTS "portal_added_at" timestamp (0) with time zone;
--> statement-breakpoint
-- Backfill existing portal deals from their creation date so the "Latest Deals"
-- recency window has a value to filter on (deals already older than the window
-- naturally drop out; recently-created ones remain until they age out).
UPDATE "quote_table" SET "portal_added_at" = "date_created" WHERE "show_on_portal" = true AND "portal_added_at" IS NULL;