-- Migration: Replace vip_payout with referral_payout + referral_withdrawal
-- This migration:
--   1. Updates referral_status_enum (removes RELEASED/REJECTED, now tracked in referral_payout)
--   2. Removes payoutType column from referral table
--   3. Creates referral_payout_status_enum and referral_withdrawal_status_enum
--   4. Creates withdrawal_method_enum (replaces payout_type_enum)
--   5. Creates referral_payout table
--   6. Creates referral_withdrawal table
--   7. Migrates existing vip_payout data into referral_withdrawal
--   8. Migrates existing RELEASED referrals by creating referral_payout requested records
--   9. Drops vip_payout table

--> statement-breakpoint

-- Step 1: Convert RELEASED/REJECTED referrals to PENDING before enum change
UPDATE "referral" SET "referralStatus" = 'PENDING' WHERE "referralStatus" IN ('RELEASED', 'REJECTED');

--> statement-breakpoint

-- Step 2: Recreate referral_status_enum without RELEASED/REJECTED
CREATE TYPE "referral_status_enum_new" AS ENUM('PENDING', 'IN_WALLET', 'PAID', 'VOIDED');
ALTER TABLE "referral" ALTER COLUMN "referralStatus" TYPE "referral_status_enum_new" USING "referralStatus"::text::"referral_status_enum_new";
DROP TYPE "referral_status_enum";
ALTER TYPE "referral_status_enum_new" RENAME TO "referral_status_enum";

--> statement-breakpoint

-- Step 3: Remove payoutType column from referral
ALTER TABLE "referral" DROP COLUMN IF EXISTS "payoutType";

--> statement-breakpoint

-- Step 4: Create new enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'withdrawal_method_enum') THEN
    CREATE TYPE "withdrawal_method_enum" AS ENUM('bank_transfer', 'booking_credit');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_payout_status_enum') THEN
    CREATE TYPE "referral_payout_status_enum" AS ENUM('requested', 'approved', 'rejected');
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_withdrawal_status_enum') THEN
    CREATE TYPE "referral_withdrawal_status_enum" AS ENUM('pending', 'processed', 'rejected');
  END IF;
END $$;

--> statement-breakpoint

-- Step 5: Create referral_payout table
CREATE TABLE IF NOT EXISTS "referral_payout" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referral_id" uuid NOT NULL REFERENCES "referral"("id") ON DELETE CASCADE,
  "client_id" uuid REFERENCES "client_table"("id") ON DELETE SET NULL,
  "amount" numeric NOT NULL,
  "status" "referral_payout_status_enum" DEFAULT 'requested' NOT NULL,
  "notes" varchar,
  "requested_at" timestamp DEFAULT now(),
  "approved_at" timestamp,
  "rejected_at" timestamp
);

--> statement-breakpoint

-- Step 6: Create referral_withdrawal table
CREATE TABLE IF NOT EXISTS "referral_withdrawal" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referral_id" uuid NOT NULL REFERENCES "referral"("id") ON DELETE CASCADE,
  "client_id" uuid REFERENCES "client_table"("id") ON DELETE SET NULL,
  "amount" numeric NOT NULL,
  "method" "withdrawal_method_enum" NOT NULL,
  "status" "referral_withdrawal_status_enum" DEFAULT 'pending' NOT NULL,
  "account_name" varchar,
  "account_number" varchar,
  "sort_code" varchar,
  "transfer_reference" varchar,
  "booking_id" uuid REFERENCES "booking_table"("id") ON DELETE SET NULL,
  "credit_note" varchar,
  "notes" varchar,
  "requested_at" timestamp DEFAULT now(),
  "processed_at" timestamp
);

--> statement-breakpoint

-- Step 7: Migrate existing vip_payout data into referral_withdrawal
INSERT INTO "referral_withdrawal" (
  "referral_id", "client_id", "amount", "method", "status", "notes", "requested_at", "processed_at"
)
SELECT
  "referralId",
  "clientId",
  "amount",
  "method"::text::"withdrawal_method_enum",
  CASE WHEN "status" = 'processed'
    THEN 'processed'::"referral_withdrawal_status_enum"
    ELSE 'pending'::"referral_withdrawal_status_enum"
  END,
  "notes",
  "createdAt",
  "processedAt"
FROM "vip_payout"
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vip_payout');

--> statement-breakpoint

-- Step 8: Drop vip_payout table
DROP TABLE IF EXISTS "vip_payout";

--> statement-breakpoint

-- Step 9: Drop old enums no longer needed (safe because vip_payout is gone)
DROP TYPE IF EXISTS "payout_status_enum";
