ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "email" varchar;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "opening_pattern" varchar;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "bank_holidays_open" boolean NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "opening_hours" jsonb DEFAULT '[]'::jsonb;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "verification_token" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "verification_token_expiry" timestamp;
