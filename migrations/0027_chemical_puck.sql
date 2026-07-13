CREATE TABLE "sendseven_conversation_state" (
	"conversation_id" text PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"contact_id" text,
	"client_id" uuid,
	"intent" text,
	"enquiry_slots" jsonb,
	"enquiry_status" text,
	"enquiry_id" text,
	"needs_human" boolean DEFAULT false NOT NULL,
	"handled_by_human_at" timestamp,
	"context" jsonb,
	"last_ai_reply_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "sendseven_conversation_state" ADD CONSTRAINT "sendseven_conversation_state_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sendseven_conversation_state" ADD CONSTRAINT "sendseven_conversation_state_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;