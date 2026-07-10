CREATE TABLE "sendseven_contact_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sendseven_contact_id" text NOT NULL,
	"client_id" uuid NOT NULL,
	"linked_by" text,
	"linked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sendseven_contact_links_org_contact_unique" UNIQUE("org_id","sendseven_contact_id"),
	CONSTRAINT "sendseven_contact_links_org_client_unique" UNIQUE("org_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "sendseven_contact_links" ADD CONSTRAINT "sendseven_contact_links_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sendseven_contact_links" ADD CONSTRAINT "sendseven_contact_links_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sendseven_contact_links" ADD CONSTRAINT "sendseven_contact_links_linked_by_user_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;