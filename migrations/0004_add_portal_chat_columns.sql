ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "portal_client_id" uuid;
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD COLUMN IF NOT EXISTS "portal_client_name" text;
