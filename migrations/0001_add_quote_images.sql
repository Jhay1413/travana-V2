CREATE TABLE "quote_images" (
	"id" varchar PRIMARY KEY NOT NULL,
	"quote_id" varchar,
	"url" text,
	"is_primary" boolean
);
--> statement-breakpoint
CREATE INDEX "quote_images_quote_id_idx" ON "quote_images" ("quote_id");
