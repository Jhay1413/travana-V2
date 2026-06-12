CREATE TABLE "booking_upsell" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"upsell_type" varchar NOT NULL,
	"description" varchar,
	"quantity" integer DEFAULT 1 NOT NULL,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"sales_price" numeric(10, 2),
	"added_at" timestamp with time zone DEFAULT now(),
	"added_by" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "booking_upsell" ADD CONSTRAINT "booking_upsell_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_upsell" ADD CONSTRAINT "booking_upsell_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;