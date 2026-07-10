ALTER TABLE "sendseven_integrations" ALTER COLUMN "encrypted_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sendseven_integrations" ADD COLUMN "tenant_id" text;