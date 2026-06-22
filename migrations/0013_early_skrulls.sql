ALTER TABLE "client_table" ADD COLUMN "referral_commission_rate" numeric DEFAULT '25' NOT NULL;--> statement-breakpoint
ALTER TABLE "referral" ADD COLUMN "commissionRate" numeric;