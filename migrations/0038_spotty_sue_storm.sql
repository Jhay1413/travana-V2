ALTER TABLE "client_table" ADD COLUMN IF NOT EXISTS "ai_reply_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sendseven_conversation_state" ADD COLUMN IF NOT EXISTS "ai_override" text;
