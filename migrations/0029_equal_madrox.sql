ALTER TABLE "org_bot_config" ADD COLUMN "rules" jsonb;--> statement-breakpoint
ALTER TABLE "org_knowledge_base" ADD COLUMN "audience" text DEFAULT 'general' NOT NULL;