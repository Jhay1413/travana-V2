CREATE TABLE IF NOT EXISTS "org_social_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"default_view_link" boolean DEFAULT true NOT NULL,
	"default_price_badge" boolean DEFAULT true NOT NULL,
	"time_shortcuts" text[] DEFAULT ARRAY['09:00','12:30','19:00']::text[] NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_social_settings" ADD CONSTRAINT "org_social_settings_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_social_settings" ADD CONSTRAINT "org_social_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notes_transaction_id" ON "notes" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tasks_entity_id" ON "tasks" USING btree ("entity_id");
