CREATE TABLE "hub_post_hides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hub_post_hides_post_id_user_id_unique" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "hub_announcements" ALTER COLUMN "category" SET DEFAULT 'latest_news';--> statement-breakpoint
ALTER TABLE "hub_announcements" ADD COLUMN "post_to_all" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_post_hides" ADD CONSTRAINT "hub_post_hides_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_hides" ADD CONSTRAINT "hub_post_hides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Remap legacy announcement categories to the new sections:
--   supplier -> Supplier Codes; general/target/incentive/training -> Latest News.
-- Club Travana starts empty.
UPDATE "hub_announcements" SET "category" = 'supplier_codes' WHERE "category" = 'supplier';--> statement-breakpoint
UPDATE "hub_announcements" SET "category" = 'latest_news' WHERE "category" IN ('general','target','incentive','training');