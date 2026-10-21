CREATE TABLE IF NOT EXISTS "org_tour_operator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tour_operator_id" uuid NOT NULL,
	"commission_percentage" numeric(5, 2),
	"balance_due_weeks" integer DEFAULT 14 NOT NULL,
	"username" varchar,
	"encrypted_password" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tour_operator_table" DROP CONSTRAINT "tour_operator_table_org_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "tour_operator_table" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_table" ADD COLUMN "accepted_at" timestamp (0) with time zone;--> statement-breakpoint
ALTER TABLE "quote_table" ADD COLUMN "accepted_by" text;--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD COLUMN "code" varchar(8);--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD COLUMN "phone" varchar;--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "org_tour_operator" ADD CONSTRAINT "org_tour_operator_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "org_tour_operator" ADD CONSTRAINT "org_tour_operator_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "org_tour_operator" ADD CONSTRAINT "org_tour_operator_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_org_tour_operator_org_operator" ON "org_tour_operator" USING btree ("org_id","tour_operator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_org_tour_operator_operator" ON "org_tour_operator" USING btree ("tour_operator_id");--> statement-breakpoint
ALTER TABLE "quote_table" ADD CONSTRAINT "quote_table_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD CONSTRAINT "tour_operator_table_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_booking_main_tour_operator" ON "booking_table" USING btree ("main_tour_operator_id");--> statement-breakpoint
CREATE INDEX "idx_quote_main_tour_operator" ON "quote_table" USING btree ("main_tour_operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tour_operator_name_lower" ON "tour_operator_table" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "tour_operator_table" DROP COLUMN "commission_percentage";--> statement-breakpoint
ALTER TABLE "tour_operator_table" DROP COLUMN "org_id";