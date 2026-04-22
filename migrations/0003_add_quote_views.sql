CREATE TABLE IF NOT EXISTS "quote_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quote_id" uuid NOT NULL REFERENCES "quote"("id") ON DELETE CASCADE,
  "viewed_at" timestamptz DEFAULT now() NOT NULL,
  "ip_address" varchar(45),
  "device_type" varchar(20),
  "browser" varchar(100),
  "user_agent" text,
  "viewer_name" varchar(200)
);

CREATE TABLE IF NOT EXISTS "quote_customer_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quote_id" uuid NOT NULL REFERENCES "quote"("id") ON DELETE CASCADE,
  "action_type" text NOT NULL,
  "message" text,
  "customer_name" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- Add viewer_name to existing installations where quote_views already exists
ALTER TABLE "quote_views" ADD COLUMN IF NOT EXISTS "viewer_name" varchar(200);
