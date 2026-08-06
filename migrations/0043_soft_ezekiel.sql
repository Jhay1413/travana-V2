ALTER TABLE "supplier_scraper" DROP CONSTRAINT "uq_supplier_scraper_org_supplier";--> statement-breakpoint
ALTER TABLE "supplier_spec_archive" DROP CONSTRAINT "uq_supplier_spec_archive_org_host";--> statement-breakpoint
ALTER TABLE "supplier_scraper" DROP CONSTRAINT "supplier_scraper_org_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "supplier_spec_archive" DROP CONSTRAINT "supplier_spec_archive_org_id_organization_id_fk";
--> statement-breakpoint
DROP INDEX "idx_supplier_scraper_org";--> statement-breakpoint
DROP INDEX "idx_supplier_spec_archive_org";--> statement-breakpoint
ALTER TABLE "supplier_scraper" DROP COLUMN "org_id";--> statement-breakpoint
ALTER TABLE "supplier_spec_archive" DROP COLUMN "org_id";--> statement-breakpoint
ALTER TABLE "supplier_scraper" ADD CONSTRAINT "uq_supplier_scraper_supplier_key" UNIQUE("supplier_key");--> statement-breakpoint
ALTER TABLE "supplier_spec_archive" ADD CONSTRAINT "uq_supplier_spec_archive_host" UNIQUE("host_includes");