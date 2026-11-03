CREATE TABLE "inbox_note_authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sendseven_message_id" text NOT NULL,
	"sendseven_note_id" text,
	"conversation_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_note_authors" ADD CONSTRAINT "inbox_note_authors_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_note_authors" ADD CONSTRAINT "inbox_note_authors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_inbox_note_authors_message" ON "inbox_note_authors" USING btree ("sendseven_message_id");--> statement-breakpoint
CREATE INDEX "idx_inbox_note_authors_org" ON "inbox_note_authors" USING btree ("org_id");