CREATE TABLE "ticket_reply_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reply_id" varchar NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ticket_reply_likes_reply_id_user_id_unique" UNIQUE("reply_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "ticket_reply_likes" ADD CONSTRAINT "ticket_reply_likes_reply_id_ticket_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."ticket_replies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_reply_likes" ADD CONSTRAINT "ticket_reply_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;