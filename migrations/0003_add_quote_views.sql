CREATE TABLE IF NOT EXISTS "quote_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quote_id" uuid NOT NULL REFERENCES "quote"("id") ON DELETE CASCADE,
  "viewed_at" timestamp DEFAULT now() NOT NULL,
  "ip_address" text,
  "device_type" text,
  "browser" text,
  "user_agent" text
);

CREATE TABLE IF NOT EXISTS "quote_customer_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "quote_id" uuid NOT NULL REFERENCES "quote"("id") ON DELETE CASCADE,
  "action_type" text NOT NULL,
  "message" text,
  "customer_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
