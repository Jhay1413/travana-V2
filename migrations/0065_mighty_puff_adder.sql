ALTER TABLE "org_whatsapp_settings" ADD COLUMN "update_template_name" text;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "update_template_language" text;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "update_template_channel_id" text;--> statement-breakpoint
ALTER TABLE "org_whatsapp_settings" ADD COLUMN "update_template_variables" jsonb DEFAULT '{}'::jsonb NOT NULL;