CREATE TABLE "ai_usage_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"feature" varchar NOT NULL,
	"site" varchar,
	"model" varchar NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"conversation_id" varchar,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_monthly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"prompt_tokens" bigint DEFAULT 0 NOT NULL,
	"completion_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_monthly_org_period_unique" UNIQUE("org_id","period_start")
);
--> statement-breakpoint
CREATE TABLE "model_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model" varchar NOT NULL,
	"input_micros_per_mtok" bigint NOT NULL,
	"cached_input_micros_per_mtok" bigint DEFAULT 0 NOT NULL,
	"output_micros_per_mtok" bigint DEFAULT 0 NOT NULL,
	"effective_from" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "model_pricing_model_effective_unique" UNIQUE("model","effective_from")
);
--> statement-breakpoint
CREATE TABLE "org_usage_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"plan_tier" varchar DEFAULT 'starter' NOT NULL,
	"monthly_ai_token_limit" integer,
	"monthly_ai_message_limit" integer,
	"monthly_sendseven_msg_limit" integer,
	"ai_limits_enabled" boolean DEFAULT true NOT NULL,
	"sendseven_limits_enabled" boolean DEFAULT true NOT NULL,
	"enforcement_mode" varchar DEFAULT 'monitor' NOT NULL,
	"warn_threshold_pct" integer DEFAULT 80 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_usage_limits_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
CREATE TABLE "sendseven_message_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"ai_sent_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sendseven_message_usage_org_period_unique" UNIQUE("org_id","period_start")
);
--> statement-breakpoint
ALTER TABLE "ai_usage_event" ADD CONSTRAINT "ai_usage_event_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_monthly" ADD CONSTRAINT "ai_usage_monthly_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_usage_limits" ADD CONSTRAINT "org_usage_limits_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sendseven_message_usage" ADD CONSTRAINT "sendseven_message_usage_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_usage_event_org_created" ON "ai_usage_event" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_monthly_org_period" ON "ai_usage_monthly" USING btree ("org_id","period_start");--> statement-breakpoint
CREATE INDEX "idx_sendseven_message_usage_org_period" ON "sendseven_message_usage" USING btree ("org_id","period_start");