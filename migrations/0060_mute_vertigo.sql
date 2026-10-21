CREATE TABLE "booking_departure_checks" (
	"booking_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"check_in" boolean DEFAULT false NOT NULL,
	"tickets_in_house" boolean DEFAULT false NOT NULL,
	"passport_info" boolean DEFAULT false NOT NULL,
	"tickets_pick_up" boolean DEFAULT false NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"fully_paid" boolean DEFAULT false NOT NULL,
	"last_change_by" text,
	"last_change_by_name" text,
	"last_change_at" timestamp with time zone,
	"last_change_what" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_departure_checks" ADD CONSTRAINT "booking_departure_checks_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_departure_checks" ADD CONSTRAINT "booking_departure_checks_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_booking_departure_checks_org" ON "booking_departure_checks" USING btree ("org_id");