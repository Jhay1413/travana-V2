CREATE TYPE "wallet_transaction_type_enum" AS ENUM('credit', 'debit');
CREATE TYPE "wallet_transaction_source_enum" AS ENUM('referral_commission', 'booking_credit', 'bank_transfer');
CREATE TYPE "wallet_transaction_status_enum" AS ENUM('pending', 'processed', 'rejected');

CREATE TABLE "wallet_transaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL,
  "type" "wallet_transaction_type_enum" NOT NULL,
  "amount" numeric NOT NULL,
  "source" "wallet_transaction_source_enum" NOT NULL,
  "referral_id" uuid,
  "booking_id" uuid,
  "account_name" varchar,
  "account_number" varchar,
  "sort_code" varchar,
  "transfer_reference" varchar,
  "notes" text,
  "status" "wallet_transaction_status_enum" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "processed_at" timestamp,
  CONSTRAINT "wallet_transaction_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "client_table"("id") ON DELETE CASCADE,
  CONSTRAINT "wallet_transaction_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "referral"("id") ON DELETE SET NULL,
  CONSTRAINT "wallet_transaction_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "booking"("id") ON DELETE SET NULL
);

-- Add wallet_credit column to booking
ALTER TABLE "booking_table" ADD COLUMN IF NOT EXISTS "wallet_credit" numeric(10,2) DEFAULT 0.00;

-- Backfill: create a processed credit for every existing IN_WALLET referral
-- so their balance appears correctly in the new ledger.
INSERT INTO wallet_transaction (client_id, type, amount, source, referral_id, status, created_at, processed_at)
SELECT
  r."referrerClientId",
  'credit',
  r."payoutAmount",
  'referral_commission',
  r.id,
  'processed',
  r."createdAt",
  r."updatedAt"
FROM referral r
WHERE r."referralStatus" = 'IN_WALLET'
  AND r."referrerClientId" IS NOT NULL
  AND r."payoutAmount" IS NOT NULL
  AND r."payoutAmount"::numeric > 0;

-- Backfill: create a processed debit for every existing PAID referral that went
-- through the old referral_withdrawal system, so the ledger stays balanced.
INSERT INTO wallet_transaction (client_id, type, amount, source, referral_id, booking_id, status, created_at, processed_at)
SELECT
  r."referrerClientId",
  'debit',
  COALESCE(rw.amount, r."payoutAmount"),
  CASE WHEN rw.method = 'booking_credit' THEN 'booking_credit' ELSE 'bank_transfer' END,
  r.id,
  rw.booking_id,
  'processed',
  COALESCE(rw.requested_at, r."updatedAt"),
  COALESCE(rw.processed_at, r."updatedAt")
FROM referral r
LEFT JOIN referral_withdrawal rw ON rw.referral_id = r.id AND rw.status = 'processed'
WHERE r."referralStatus" = 'PAID'
  AND r."referrerClientId" IS NOT NULL
  AND r."payoutAmount" IS NOT NULL
  AND r."payoutAmount"::numeric > 0;
