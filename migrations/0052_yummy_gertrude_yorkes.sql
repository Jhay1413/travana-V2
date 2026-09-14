CREATE TYPE "public"."deal_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "priority" "deal_priority" DEFAULT 'low';