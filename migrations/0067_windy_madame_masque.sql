ALTER TABLE "client_table" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_table" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "org_social_settings" ADD COLUMN "allowed_account_ids" integer[];--> statement-breakpoint
ALTER TABLE "travel_deal" ADD COLUMN "only_socials_targets" jsonb;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;