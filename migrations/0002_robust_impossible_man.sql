ALTER TABLE "enquiry_table" DROP CONSTRAINT "enquiry_table_deleted_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "enquiry_table" DROP COLUMN "deleted_by";