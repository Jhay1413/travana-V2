CREATE TABLE IF NOT EXISTS "lodge_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lodge_id" uuid NOT NULL,
  "image_url" varchar NOT NULL,
  "isPrimary" boolean DEFAULT false
);

DO $$ BEGIN
 ALTER TABLE "lodge_images"
 ADD CONSTRAINT "lodge_images_lodge_id_lodges_table_id_fk"
 FOREIGN KEY ("lodge_id") REFERENCES "public"."lodges_table"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "lodge_images_lodge_id_image_url_unique"
ON "lodge_images" ("lodge_id", "image_url");
