CREATE TABLE "client_passenger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"title" varchar,
	"first_name" varchar DEFAULT '' NOT NULL,
	"surname" varchar DEFAULT '' NOT NULL,
	"date_of_birth" date,
	"passport_number" varchar(20),
	"passport_expiry" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_passenger" ADD CONSTRAINT "client_passenger_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_client_passenger_client" ON "client_passenger" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_client_passenger_one_lead" ON "client_passenger" USING btree ("client_id") WHERE "client_passenger"."is_lead" = true;