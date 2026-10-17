CREATE TABLE "org_target_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"target_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_target_org_year_month_unique" UNIQUE("organization_id","year","month")
);
--> statement-breakpoint
ALTER TABLE "agent_target_table" ADD COLUMN "source" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_target_table" ADD COLUMN "self_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "agent_target_table" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "agent_target_table" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "client_files" ADD COLUMN "uploaded_by" text;--> statement-breakpoint
ALTER TABLE "org_target_table" ADD CONSTRAINT "org_target_table_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_target_table" ADD CONSTRAINT "agent_target_table_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_files" ADD CONSTRAINT "client_files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;