CREATE TYPE "public"."client_status" AS ENUM('active', 'merged');--> statement-breakpoint
CREATE TABLE "client_merge_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_client_id" uuid NOT NULL,
	"target_client_id" uuid NOT NULL,
	"merged_by" text,
	"org_id" uuid,
	"branch_id" uuid,
	"counts" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_table" ADD COLUMN "status" "client_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "client_table" ADD COLUMN "merged_into_id" uuid;--> statement-breakpoint
ALTER TABLE "client_table" ADD COLUMN "merged_at" timestamp;--> statement-breakpoint
ALTER TABLE "client_table" ADD COLUMN "merged_by" text;--> statement-breakpoint
ALTER TABLE "client_merge_log" ADD CONSTRAINT "client_merge_log_target_client_id_client_table_id_fk" FOREIGN KEY ("target_client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_merge_log" ADD CONSTRAINT "client_merge_log_merged_by_user_id_fk" FOREIGN KEY ("merged_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_merged_into_id_client_table_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_merged_by_user_id_fk" FOREIGN KEY ("merged_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;