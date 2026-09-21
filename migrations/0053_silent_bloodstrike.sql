ALTER TABLE "destination_guru" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "destination_guru" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "destination_guru" ADD COLUMN "coordinates_source" text;--> statement-breakpoint
ALTER TABLE "destination_guru" ADD CONSTRAINT "destination_guru_lat_range" CHECK ("destination_guru"."latitude" BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "destination_guru" ADD CONSTRAINT "destination_guru_lng_range" CHECK ("destination_guru"."longitude" BETWEEN -180 AND 180);--> statement-breakpoint
ALTER TABLE "destination_guru" ADD CONSTRAINT "destination_guru_coords_pair" CHECK (("destination_guru"."latitude" IS NULL) = ("destination_guru"."longitude" IS NULL));