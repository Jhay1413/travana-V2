CREATE TABLE "supplier_scraper" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tour_operator_id" uuid,
	"supplier_key" varchar NOT NULL,
	"supplier_name" varchar NOT NULL,
	"adapter_type" varchar DEFAULT 'easyjet' NOT NULL,
	"encrypted_credentials" text,
	"config" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "uq_supplier_scraper_org_supplier" UNIQUE("org_id","supplier_key")
);
--> statement-breakpoint
ALTER TABLE "supplier_scraper" ADD CONSTRAINT "supplier_scraper_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_scraper" ADD CONSTRAINT "supplier_scraper_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_scraper" ADD CONSTRAINT "supplier_scraper_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_supplier_scraper_org" ON "supplier_scraper" USING btree ("org_id");