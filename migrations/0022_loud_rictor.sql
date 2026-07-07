CREATE TABLE "sendseven_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"encrypted_token" text NOT NULL,
	"base_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sendseven_integrations_org_id_unique" UNIQUE("org_id")
);
--> statement-breakpoint
ALTER TABLE "sendseven_integrations" ADD CONSTRAINT "sendseven_integrations_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sendseven_integrations" ADD CONSTRAINT "sendseven_integrations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;