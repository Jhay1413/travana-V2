CREATE TABLE "customer_message_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"client_id" uuid,
	"purpose" varchar(40) NOT NULL,
	"channel" varchar(10) NOT NULL,
	"status" varchar(10) NOT NULL,
	"reason" varchar(40),
	"template_name" varchar(512),
	"trigger_source" varchar(80),
	"triggered_by" text,
	"provider_message_id" varchar(120),
	"dedupe_key" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_table" ALTER COLUMN "quote_token" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "pin_reset_template_name" text;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "pin_reset_template_language" text;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "pin_reset_template_channel_id" text;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "pin_reset_template_variables" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "purpose_templates" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_login_tokens" ADD COLUMN "source" varchar(20);--> statement-breakpoint
ALTER TABLE "quote_customer_actions" ADD COLUMN "reason" varchar(100);--> statement-breakpoint
ALTER TABLE "quote_customer_actions" ADD COLUMN "wants_similar" boolean;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD COLUMN "transports" text;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_message_log" ADD CONSTRAINT "customer_message_log_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_message_log" ADD CONSTRAINT "customer_message_log_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_message_log" ADD CONSTRAINT "customer_message_log_triggered_by_user_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customer_message_log_org_created" ON "customer_message_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_message_log_client_created" ON "customer_message_log" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_customer_message_log_dedupe" ON "customer_message_log" USING btree ("org_id","client_id","purpose","dedupe_key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_quote_quote_token" ON "quote_table" USING btree ("quote_token") WHERE "quote_table"."quote_token" IS NOT NULL;