CREATE TABLE "hub_announcement_hides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hub_announcement_hides_announcement_id_user_id_unique" UNIQUE("announcement_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "hub_announcement_hides" ADD CONSTRAINT "hub_announcement_hides_announcement_id_hub_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."hub_announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_announcement_hides" ADD CONSTRAINT "hub_announcement_hides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;