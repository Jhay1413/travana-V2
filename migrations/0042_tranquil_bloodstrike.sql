CREATE TABLE "supplier_spec_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"host_includes" varchar NOT NULL,
	"supplier_key" varchar NOT NULL,
	"extraction" jsonb NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_supplier_spec_archive_org_host" UNIQUE("org_id","host_includes")
);
--> statement-breakpoint
ALTER TABLE "supplier_spec_archive" ADD CONSTRAINT "supplier_spec_archive_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_supplier_spec_archive_org" ON "supplier_spec_archive" USING btree ("org_id");