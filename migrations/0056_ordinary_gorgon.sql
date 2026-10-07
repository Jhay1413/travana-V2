CREATE TYPE "public"."image_upscale_source_kind_enum" AS ENUM('quote_image', 'upload');--> statement-breakpoint
CREATE TYPE "public"."image_upscale_status_enum" AS ENUM('queued', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "image_upscale_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_by" text,
	"quote_id" uuid,
	"source_kind" "image_upscale_source_kind_enum" NOT NULL,
	"original_url" text NOT NULL,
	"result_url" text,
	"status" "image_upscale_status_enum" DEFAULT 'queued' NOT NULL,
	"error" text,
	"scale" integer,
	"source_width" integer,
	"source_height" integer,
	"result_width" integer,
	"result_height" integer,
	"replaced_on_quote" boolean DEFAULT false NOT NULL,
	"reverted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "image_upscale_job" ADD CONSTRAINT "image_upscale_job_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_upscale_job" ADD CONSTRAINT "image_upscale_job_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_upscale_job" ADD CONSTRAINT "image_upscale_job_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_image_upscale_job_quote" ON "image_upscale_job" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_image_upscale_job_org_created" ON "image_upscale_job" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_image_upscale_job_active_quote_image" ON "image_upscale_job" USING btree ("quote_id","original_url") WHERE "image_upscale_job"."status" in ('queued', 'processing');--> statement-breakpoint
CREATE INDEX "idx_image_upscale_job_active" ON "image_upscale_job" USING btree ("status") WHERE "image_upscale_job"."status" in ('queued', 'processing');