-- Carry existing booking links over to the transaction before the old column goes.
UPDATE "tickets" t SET "transaction_id" = b."transaction_id" FROM "booking_table" b WHERE t."booking_id" = b."id" AND t."transaction_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_booking_id_booking_table_id_fk";
--> statement-breakpoint
ALTER TABLE "tickets" DROP COLUMN "booking_id";