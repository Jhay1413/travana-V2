CREATE TABLE "org_whatsapp_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"quote_template_name" text,
	"quote_template_language" text,
	"quote_template_channel_id" text,
	"quote_template_variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD CONSTRAINT "org_whatsapp_settings_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD CONSTRAINT "org_whatsapp_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;