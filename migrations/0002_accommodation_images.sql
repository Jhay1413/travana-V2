CREATE TABLE IF NOT EXISTS "accommodation_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "accommodation_id" uuid NOT NULL,
  "image_url" varchar NOT NULL,
  "isPrimary" boolean DEFAULT false
);

DO $$ BEGIN
 ALTER TABLE "accommodation_images"
 ADD CONSTRAINT "accommodation_images_accommodation_id_accomodation_list_table_id_fk"
 FOREIGN KEY ("accommodation_id") REFERENCES "public"."accomodation_list_table"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "accommodation_images_accommodation_id_image_url_unique"
ON "accommodation_images" ("accommodation_id", "image_url");
