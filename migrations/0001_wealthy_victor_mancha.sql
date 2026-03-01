ALTER TABLE "transaction" DROP CONSTRAINT "transaction_agent_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "transaction" DROP COLUMN "agent_id";