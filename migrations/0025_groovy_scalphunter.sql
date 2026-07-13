CREATE TABLE "sendseven_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"org_id" uuid,
	"message_id" text,
	"type" text,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sendseven_webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "sendseven_integrations" ADD COLUMN "webhook_endpoint_id" text;--> statement-breakpoint
ALTER TABLE "sendseven_integrations" ADD COLUMN "webhook_secret" text;--> statement-breakpoint
ALTER TABLE "sendseven_integrations" ADD COLUMN "auto_reply_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sendseven_integrations" ADD COLUMN "auto_reply_mode" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "sendseven_webhook_events" ADD CONSTRAINT "sendseven_webhook_events_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;