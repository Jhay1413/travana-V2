CREATE TABLE "homeworker_payout_statement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_id" text,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_profit" numeric(12, 2) NOT NULL,
	"share_percent" numeric(5, 2) NOT NULL,
	"homeworker_share" numeric(12, 2) NOT NULL,
	"org_share" numeric(12, 2) NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"finalised_by" text,
	"finalised_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "homeworker_payout_branch_period_unique" UNIQUE("branch_id","period_start"),
	CONSTRAINT "homeworker_payout_status_check" CHECK ("homeworker_payout_statement"."status" IN ('draft', 'final')),
	CONSTRAINT "homeworker_payout_period_order" CHECK ("homeworker_payout_statement"."period_end" > "homeworker_payout_statement"."period_start"),
	CONSTRAINT "homeworker_payout_share_range" CHECK ("homeworker_payout_statement"."share_percent" BETWEEN 0 AND 100)
);
--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "profit_share_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "client_table" ADD COLUMN "split_from_client_id" uuid;--> statement-breakpoint
ALTER TABLE "homeworker_payout_statement" ADD CONSTRAINT "homeworker_payout_statement_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeworker_payout_statement" ADD CONSTRAINT "homeworker_payout_statement_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeworker_payout_statement" ADD CONSTRAINT "homeworker_payout_statement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeworker_payout_statement" ADD CONSTRAINT "homeworker_payout_statement_finalised_by_user_id_fk" FOREIGN KEY ("finalised_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_homeworker_payout_org_period" ON "homeworker_payout_statement" USING btree ("org_id","period_start");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_split_from_client_id_client_table_id_fk" FOREIGN KEY ("split_from_client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_branches_org_type" ON "branches" USING btree ("organization_id","branch_type");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_owner_user_id_unique" UNIQUE("owner_user_id");--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_branch_type_check" CHECK ("branches"."branch_type" IN ('shop', 'homeworker'));--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_profit_share_range" CHECK ("branches"."profit_share_percent" IS NULL OR "branches"."profit_share_percent" BETWEEN 0 AND 100);--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_homeworker_fields_check" CHECK ("branches"."branch_type" = 'homeworker' OR ("branches"."owner_user_id" IS NULL AND "branches"."profit_share_percent" IS NULL));