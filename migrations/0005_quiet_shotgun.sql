CREATE TABLE "portal_login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"client_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "portal_login_tokens_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "portal_login_tokens" ADD CONSTRAINT "portal_login_tokens_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;