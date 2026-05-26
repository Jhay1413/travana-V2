-- Per-org SMS credit accounting + overage billing.
--
-- Free tier: monthly_sms_credit_limit credits per UTC calendar month (default 100).
-- Anything beyond the allowance is billed at sms_overage_price_cents per credit
-- (default 5 cents). Admins can disable the gate per-org via sms_credits_enabled=false.
--
-- The "period" is the first-of-month (UTC). usage rows are upserted on first send.

ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "monthly_sms_credit_limit" integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "sms_overage_price_cents"  integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "sms_credits_enabled"      boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "sms_credit_usage" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"          uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "period_start"    date NOT NULL,
  "credits_used"    integer NOT NULL DEFAULT 0,
  "credits_granted" integer NOT NULL DEFAULT 0,
  "created_at"      timestamp NOT NULL DEFAULT NOW(),
  "updated_at"      timestamp NOT NULL DEFAULT NOW(),
  UNIQUE ("org_id", "period_start")
);
CREATE INDEX IF NOT EXISTS "idx_sms_credit_usage_org_period"
  ON "sms_credit_usage" ("org_id", "period_start" DESC);

CREATE TABLE IF NOT EXISTS "sms_credit_charge" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"           uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "sms_message_id"   uuid REFERENCES "sms_messages"("id") ON DELETE SET NULL,
  "period_start"     date NOT NULL,
  "credits"          integer NOT NULL DEFAULT 1,
  "unit_price_cents" integer NOT NULL,
  "amount_cents"     integer NOT NULL,
  "status"           varchar(16) NOT NULL DEFAULT 'pending',
  "invoiced_at"      timestamp,
  "paid_at"          timestamp,
  "created_at"       timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_sms_credit_charge_org_status"
  ON "sms_credit_charge" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "idx_sms_credit_charge_period"
  ON "sms_credit_charge" ("org_id", "period_start" DESC);
