CREATE TYPE "public"."booking_status_enum" AS ENUM('BOOKED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."budget_type_enum" AS ENUM('PER_PERSON', 'PACKAGE');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status_enum" AS ENUM('NEW_LEAD', 'ACTIVE', 'LOST', 'INACTIVE', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."lead_source_enum" AS ENUM('SHOP', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM', 'PHONE_ENQUIRY');--> statement-breakpoint
CREATE TYPE "public"."owner_type_enum" AS ENUM('package_holiday', 'hot_tub_break', 'cruise');--> statement-breakpoint
CREATE TYPE "public"."quote_status_enum" AS ENUM('NEW_LEAD', 'QUOTE_IN_PROGRESS', 'QUOTE_CALL', 'QUOTE_READY', 'AWAITING_DECISION', 'REQUOTE', 'WON', 'ARCHIVED', 'LOST', 'INACTIVE', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."referral_request_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."referral_status_enum" AS ENUM('PENDING', 'RELEASED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."transaction_status_enum" AS ENUM('on_enquiry', 'on_quote', 'on_booking');--> statement-breakpoint
CREATE TABLE "accomodation_list_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" uuid,
	"name" varchar NOT NULL,
	"resorts_id" uuid,
	"description" varchar
);
--> statement-breakpoint
CREATE TABLE "accomodation_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar
);
--> statement-breakpoint
CREATE TABLE "airport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"airport_code" varchar NOT NULL,
	"airport_name" varchar NOT NULL,
	"country_id" uuid
);
--> statement-breakpoint
CREATE TABLE "board_basis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"deal_type" varchar,
	"pre_booked_seats" varchar,
	"flight_meals" boolean DEFAULT false,
	"holiday_type_id" uuid NOT NULL,
	"hays_ref" varchar NOT NULL,
	"supplier_ref" varchar NOT NULL,
	"is_active" boolean DEFAULT true,
	"sales_price" numeric(10, 2),
	"package_commission" numeric(10, 2),
	"travel_date" date NOT NULL,
	"title" varchar,
	"discounts" numeric(10, 2),
	"service_charge" numeric(10, 2),
	"num_of_nights" integer DEFAULT 0 NOT NULL,
	"pets" integer DEFAULT 0 NOT NULL,
	"cottage_id" uuid,
	"lodge_id" uuid,
	"lodge_type" varchar,
	"transfer_type" varchar,
	"infant" integer DEFAULT 0 NOT NULL,
	"child" integer DEFAULT 0 NOT NULL,
	"adult" integer DEFAULT 0 NOT NULL,
	"booking_status" "booking_status_enum",
	"main_tour_operator_id" uuid,
	"date_created" timestamp with time zone DEFAULT now(),
	"deletion_code" varchar,
	"deleted_by" text,
	"deleted_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "booking_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "booking_accomodation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"no_of_nights" integer DEFAULT 0 NOT NULL,
	"room_type" varchar,
	"board_basis_id" uuid,
	"check_in_date_time" timestamp,
	"stay_type" varchar,
	"is_primary" boolean DEFAULT false,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"accomodation_id" uuid,
	"booking_id" uuid
);
--> statement-breakpoint
CREATE TABLE "booking_airport_parking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" varchar,
	"booking_id" uuid,
	"airport_id" uuid,
	"parking_type" varchar,
	"parking_date" timestamp,
	"car_make" varchar,
	"car_model" varchar,
	"colour" varchar,
	"car_reg_number" varchar,
	"duration" varchar,
	"tour_operator_id" uuid,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "booking_attraction_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"ticket_type" varchar,
	"date_of_visit" timestamp,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"number_of_tickets" integer,
	"is_included_in_package" boolean
);
--> statement-breakpoint
CREATE TABLE "booking_car_hire" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"pick_up_location" varchar,
	"drop_off_location" varchar,
	"pick_up_time" timestamp,
	"drop_off_time" timestamp,
	"no_of_days" integer,
	"driver_age" integer,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "booking_cruise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"tour_operator_id" uuid,
	"cruise_line" varchar,
	"ship" varchar,
	"cruise_date" date,
	"cabin_type" varchar,
	"cruise_name" varchar,
	"pre_cruise_stay" integer,
	"post_cruise_stay" integer
);
--> statement-breakpoint
CREATE TABLE "booking_cruise_item_extra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_extra_id" uuid,
	"booking_cruise_id" uuid
);
--> statement-breakpoint
CREATE TABLE "booking_cruise_itinerary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_cruise_id" uuid,
	"day_number" integer,
	"description" varchar
);
--> statement-breakpoint
CREATE TABLE "booking_flights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"flight_number" varchar,
	"flight_ref" varchar,
	"departing_airport_id" uuid,
	"arrival_airport_id" uuid,
	"tour_operator_id" uuid,
	"flight_type" varchar,
	"departure_date_time" timestamp,
	"arrival_date_time" timestamp,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "booking_lounge_pass" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"booking_ref" varchar,
	"terminal" varchar,
	"airport_id" uuid,
	"date_of_usage" timestamp,
	"tour_operator_id" uuid,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"is_included_in_package" boolean,
	"note" varchar
);
--> statement-breakpoint
CREATE TABLE "booking_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"pick_up_location" varchar,
	"drop_off_location" varchar,
	"pick_up_time" timestamp,
	"drop_off_time" timestamp,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"booking_id" uuid,
	"note" varchar
);
--> statement-breakpoint
CREATE TABLE "client_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar,
	"firstName" varchar NOT NULL,
	"surename" varchar NOT NULL,
	"DOB" date,
	"phoneNumber" varchar NOT NULL,
	"email" varchar,
	"emailIsAllowed" boolean,
	"VMB" varchar,
	"VMBfirstAccess" varchar,
	"whatsAppVerified" boolean DEFAULT false NOT NULL,
	"mailAllowed" boolean DEFAULT false,
	"houseNumber" varchar,
	"city" varchar,
	"street" varchar,
	"country" varchar,
	"post_code" varchar,
	"avatarUrl" varchar,
	"badge" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"referrerId" text
);
--> statement-breakpoint
CREATE TABLE "cottages_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cottage_name" varchar,
	"location" varchar,
	"cottage_code" varchar,
	"bedrooms" integer,
	"bathrooms" integer,
	"sleeps" integer,
	"pets" integer,
	"image_1" varchar,
	"image_2" varchar,
	"details_url" varchar
);
--> statement-breakpoint
CREATE TABLE "country_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_name" varchar NOT NULL,
	"country_code" varchar
);
--> statement-breakpoint
CREATE TABLE "cruise_destination" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "cruise_extra_item_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "cruise_itenary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ship_id" uuid,
	"itenary" varchar,
	"departure_port" varchar NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "cruise_ship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar,
	"cruise_line_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cruise_voyage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"itinerary_id" uuid,
	"day_number" numeric,
	"description" varchar
);
--> statement-breakpoint
CREATE TABLE "deal_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" varchar,
	"s3Key" varchar,
	"owner_type" "owner_type_enum",
	"owner_id" text NOT NULL,
	"isPrimary" boolean DEFAULT false,
	CONSTRAINT "deal_images_owner_id_image_url_unique" UNIQUE("owner_id","image_url")
);
--> statement-breakpoint
CREATE TABLE "deletion_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_used" boolean DEFAULT false,
	"code" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "destination_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar,
	"country_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_accomodation" (
	"enquiry_id" uuid,
	"accomodation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_board_basis" (
	"enquiry_id" uuid,
	"board_basis_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_cruise_destination" (
	"enquiry_id" uuid,
	"cruise_destination_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_cruise_line" (
	"enquiry_id" uuid,
	"cruise_line_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_departure_airport" (
	"enquiry_id" uuid,
	"airport_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_departure_port" (
	"enquiry_id" uuid,
	"port_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_destination" (
	"enquiry_id" uuid,
	"destination_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_passenger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid,
	"type" varchar,
	"age" integer
);
--> statement-breakpoint
CREATE TABLE "enquiry_resorts" (
	"enquiry_id" uuid,
	"resorts_id" uuid
);
--> statement-breakpoint
CREATE TABLE "enquiry_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"holiday_type_id" uuid NOT NULL,
	"accomodation_type_id" uuid,
	"travel_date" date,
	"adults" integer,
	"children" integer,
	"infants" integer,
	"cabin_type" varchar,
	"title" varchar,
	"flexibility_date" varchar,
	"flexible_date" varchar,
	"weekend_lodge" varchar,
	"accom_min_star_rating" varchar,
	"no_of_nights" integer,
	"budget" numeric,
	"max_budget" numeric DEFAULT '0.00',
	"budget_type" "budget_type_enum" DEFAULT 'PACKAGE',
	"no_of_guests" integer,
	"no_of_pets" integer,
	"pre_cruise_stay" integer,
	"post_cruise_stay" integer,
	"status" "enquiry_status_enum" DEFAULT 'NEW_LEAD',
	"date_created" timestamp with time zone DEFAULT now(),
	"date_expiry" timestamp with time zone,
	"is_future_deal" boolean DEFAULT false,
	"future_deal_date" date,
	"is_expired" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"deletion_code" varchar,
	"deleted_by" text,
	"deleted_at" timestamp with time zone,
	"email" varchar,
	CONSTRAINT "enquiry_table_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" varchar NOT NULL,
	"label" text NOT NULL,
	"subtitle" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forwards_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" integer NOT NULL,
	"monthName" varchar NOT NULL,
	"year" integer NOT NULL,
	"target" numeric(10, 2) NOT NULL,
	"company_commission" numeric(10, 2) NOT NULL,
	"agent_commission" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"adjustment" numeric(10, 2) DEFAULT '0.00',
	"deal_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"historical_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	CONSTRAINT "forwards_report_year_month_unique" UNIQUE("year","month")
);
--> statement-breakpoint
CREATE TABLE "lodges_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"park_id" uuid,
	"lodge_name" varchar,
	"lodge_code" varchar,
	"image" varchar,
	"adults" integer,
	"children" integer,
	"bedrooms" integer,
	"bathrooms" integer,
	"pets" integer,
	"sleeps" integer,
	"infants" integer
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" varchar,
	"content" text,
	"agent_id" text,
	"user_id" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"parent_id" varchar,
	"transaction_id" uuid
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_type_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "park_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar,
	"image_1" varchar,
	"image_2" varchar,
	"location" varchar,
	"city" varchar,
	"county" varchar,
	"code" varchar,
	"description" varchar
);
--> statement-breakpoint
CREATE TABLE "passengers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar,
	"age" integer DEFAULT 0 NOT NULL,
	"quote_id" uuid,
	"lounge_pass_id" uuid,
	"booking_id" uuid
);
--> statement-breakpoint
CREATE TABLE "port" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_destination_id" uuid,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"deal_id" varchar,
	"holiday_type_id" uuid NOT NULL,
	"sales_price" numeric(10, 2),
	"package_commission" numeric(10, 2),
	"travel_date" date NOT NULL,
	"discounts" numeric(10, 2),
	"service_charge" numeric(10, 2),
	"num_of_nights" integer DEFAULT 0 NOT NULL,
	"pets" integer DEFAULT 0 NOT NULL,
	"cottage_id" uuid,
	"lodge_id" uuid,
	"quote_type" varchar NOT NULL,
	"deal_type" varchar,
	"pre_booked_seats" varchar,
	"flight_meals" boolean DEFAULT false,
	"infant" integer,
	"child" integer,
	"adult" integer,
	"title" varchar,
	"price_per_person" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"lodge_type" varchar,
	"transfer_type" varchar DEFAULT 'none' NOT NULL,
	"quote_status" "quote_status_enum",
	"main_tour_operator_id" uuid,
	"date_created" timestamp with time zone DEFAULT now(),
	"date_expiry" timestamp with time zone,
	"is_future_deal" boolean DEFAULT false,
	"future_deal_date" date,
	"is_active" boolean DEFAULT true,
	"deletion_code" varchar,
	"deleted_by" text,
	"deleted_at" timestamp with time zone,
	"quote_ref" varchar,
	"isQuoteCopy" boolean DEFAULT false,
	"isFreeQuote" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "quote_accomodation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"no_of_nights" integer DEFAULT 0 NOT NULL,
	"room_type" varchar,
	"board_basis_id" uuid,
	"check_in_date_time" timestamp (6) with time zone,
	"stay_type" varchar,
	"is_primary" boolean DEFAULT false,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"accomodation_id" uuid,
	"quote_id" uuid
);
--> statement-breakpoint
CREATE TABLE "quote_airport_parking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" varchar,
	"quote_id" uuid,
	"airport_id" uuid,
	"parking_type" varchar,
	"parking_date" timestamp,
	"car_make" varchar,
	"car_model" varchar,
	"colour" varchar,
	"car_reg_number" varchar,
	"duration" varchar,
	"tour_operator_id" uuid,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "quote_attraction_ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"ticket_type" varchar,
	"date_of_visit" timestamp,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"number_of_tickets" integer DEFAULT 0 NOT NULL,
	"is_included_in_package" boolean
);
--> statement-breakpoint
CREATE TABLE "quote_car_hire" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"pick_up_location" varchar,
	"drop_off_location" varchar,
	"pick_up_time" timestamp,
	"drop_off_time" timestamp,
	"no_of_days" integer DEFAULT 0 NOT NULL,
	"driver_age" integer DEFAULT 0 NOT NULL,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "quote_cruise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tour_operator_id" uuid,
	"cruise_line" varchar,
	"ship" varchar,
	"cruise_date" date,
	"cabin_type" varchar,
	"cruise_name" varchar,
	"pre_cruise_stay" integer NOT NULL,
	"post_cruise_stay" integer NOT NULL,
	"quote_id" uuid
);
--> statement-breakpoint
CREATE TABLE "quote_cruise_item_extra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_extra_id" uuid,
	"quote_cruise_id" uuid
);
--> statement-breakpoint
CREATE TABLE "quote_cruise_itinerary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_cruise_id" uuid,
	"day_number" integer,
	"description" varchar
);
--> statement-breakpoint
CREATE TABLE "quote_flights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"flight_number" varchar,
	"flight_ref" varchar,
	"departing_airport_id" uuid,
	"arrival_airport_id" uuid,
	"tour_operator_id" uuid,
	"flight_type" varchar,
	"departure_date_time" timestamp,
	"arrival_date_time" timestamp,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2)
);
--> statement-breakpoint
CREATE TABLE "quote_lounge_pass" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid,
	"booking_ref" varchar,
	"terminal" varchar,
	"airport_id" uuid,
	"date_of_usage" timestamp,
	"tour_operator_id" uuid,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"is_included_in_package" boolean,
	"note" varchar
);
--> statement-breakpoint
CREATE TABLE "quote_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_ref" varchar,
	"tour_operator_id" uuid,
	"pick_up_location" varchar,
	"drop_off_location" varchar,
	"pick_up_time" timestamp,
	"drop_off_time" timestamp,
	"is_included_in_package" boolean,
	"cost" numeric(10, 2),
	"commission" numeric(10, 2),
	"quote_id" uuid,
	"note" varchar
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrerId" text,
	"transactionId" uuid,
	"referralStatus" "referral_status_enum" DEFAULT 'PENDING',
	"potentialCommission" numeric,
	"commission" numeric,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrerId" text,
	"referredStatus" "referral_request_status_enum" DEFAULT 'PENDING',
	"notes" varchar,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now(),
	"clientId" uuid
);
--> statement-breakpoint
CREATE TABLE "resorts_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"destination_id" uuid
);
--> statement-breakpoint
CREATE TABLE "room_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text,
	"user_id" text,
	"client_id" uuid,
	"assigned_by_id" text,
	"transaction_id" uuid,
	"deal_id" varchar,
	"transaction_type" varchar,
	"title" varchar,
	"type" varchar DEFAULT 'task',
	"task" varchar,
	"due_date" timestamp,
	"number" varchar,
	"priority" varchar,
	"status" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_replies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" text NOT NULL,
	"parent_reply_id" varchar,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "tour_operator_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "tour_package_commission_table" (
	"package_type_id" uuid,
	"tour_operator_id" uuid,
	"percentage_commission" numeric(5, 2),
	CONSTRAINT "id" PRIMARY KEY("package_type_id","tour_operator_id")
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "transaction_status_enum",
	"is_active" boolean DEFAULT true,
	"client_id" uuid,
	"holiday_type_id" uuid,
	"agent_id" text,
	"lead_source" "lead_source_enum" DEFAULT 'SHOP',
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_deal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar NOT NULL,
	"subtitle" varchar,
	"post" text NOT NULL,
	"resortSummary" varchar,
	"hashtags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"travelDate" date,
	"nights" integer NOT NULL,
	"boardBasis" varchar,
	"departureAirport" varchar,
	"postSchedule" timestamp with time zone,
	"onlySocialsId" varchar,
	"luggageTransfers" varchar,
	"price" numeric(10, 2),
	"quote_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"role" text NOT NULL,
	"banned" boolean DEFAULT false,
	"banReason" text,
	"banExpires" timestamp,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"phoneNumber" text NOT NULL,
	"orgName" text,
	"percentageCommission" integer,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "accomodation_list_table" ADD CONSTRAINT "accomodation_list_table_type_id_accomodation_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."accomodation_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accomodation_list_table" ADD CONSTRAINT "accomodation_list_table_resorts_id_resorts_table_id_fk" FOREIGN KEY ("resorts_id") REFERENCES "public"."resorts_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airport" ADD CONSTRAINT "airport_country_id_country_table_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_holiday_type_id_package_type_table_id_fk" FOREIGN KEY ("holiday_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_cottage_id_cottages_table_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_lodge_id_lodges_table_id_fk" FOREIGN KEY ("lodge_id") REFERENCES "public"."lodges_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_main_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("main_tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_board_basis_id_board_basis_id_fk" FOREIGN KEY ("board_basis_id") REFERENCES "public"."board_basis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_accomodation_id_accomodation_list_table_id_fk" FOREIGN KEY ("accomodation_id") REFERENCES "public"."accomodation_list_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_airport_parking" ADD CONSTRAINT "booking_airport_parking_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_airport_parking" ADD CONSTRAINT "booking_airport_parking_airport_id_airport_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_airport_parking" ADD CONSTRAINT "booking_airport_parking_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attraction_ticket" ADD CONSTRAINT "booking_attraction_ticket_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attraction_ticket" ADD CONSTRAINT "booking_attraction_ticket_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_car_hire" ADD CONSTRAINT "booking_car_hire_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_car_hire" ADD CONSTRAINT "booking_car_hire_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise" ADD CONSTRAINT "booking_cruise_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise" ADD CONSTRAINT "booking_cruise_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise_item_extra" ADD CONSTRAINT "booking_cruise_item_extra_cruise_extra_id_cruise_extra_item_table_id_fk" FOREIGN KEY ("cruise_extra_id") REFERENCES "public"."cruise_extra_item_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise_item_extra" ADD CONSTRAINT "booking_cruise_item_extra_booking_cruise_id_booking_cruise_id_fk" FOREIGN KEY ("booking_cruise_id") REFERENCES "public"."booking_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise_itinerary" ADD CONSTRAINT "booking_cruise_itinerary_booking_cruise_id_booking_cruise_id_fk" FOREIGN KEY ("booking_cruise_id") REFERENCES "public"."booking_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_departing_airport_id_airport_id_fk" FOREIGN KEY ("departing_airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_arrival_airport_id_airport_id_fk" FOREIGN KEY ("arrival_airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lounge_pass" ADD CONSTRAINT "booking_lounge_pass_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lounge_pass" ADD CONSTRAINT "booking_lounge_pass_airport_id_airport_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lounge_pass" ADD CONSTRAINT "booking_lounge_pass_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_transfers" ADD CONSTRAINT "booking_transfers_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_transfers" ADD CONSTRAINT "booking_transfers_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_referrerId_user_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_itenary" ADD CONSTRAINT "cruise_itenary_ship_id_cruise_ship_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."cruise_ship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_ship" ADD CONSTRAINT "cruise_ship_cruise_line_id_cruise_line_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "public"."cruise_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_voyage" ADD CONSTRAINT "cruise_voyage_itinerary_id_cruise_itenary_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."cruise_itenary"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_table" ADD CONSTRAINT "destination_table_country_id_country_table_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_accomodation" ADD CONSTRAINT "enquiry_accomodation_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_accomodation" ADD CONSTRAINT "enquiry_accomodation_accomodation_id_accomodation_list_table_id_fk" FOREIGN KEY ("accomodation_id") REFERENCES "public"."accomodation_list_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_board_basis" ADD CONSTRAINT "enquiry_board_basis_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_board_basis" ADD CONSTRAINT "enquiry_board_basis_board_basis_id_board_basis_id_fk" FOREIGN KEY ("board_basis_id") REFERENCES "public"."board_basis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_destination" ADD CONSTRAINT "enquiry_cruise_destination_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_destination" ADD CONSTRAINT "enquiry_cruise_destination_cruise_destination_id_cruise_destination_id_fk" FOREIGN KEY ("cruise_destination_id") REFERENCES "public"."cruise_destination"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_line" ADD CONSTRAINT "enquiry_cruise_line_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_line" ADD CONSTRAINT "enquiry_cruise_line_cruise_line_id_cruise_line_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "public"."cruise_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_airport" ADD CONSTRAINT "enquiry_departure_airport_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_airport" ADD CONSTRAINT "enquiry_departure_airport_airport_id_airport_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_port" ADD CONSTRAINT "enquiry_departure_port_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_port" ADD CONSTRAINT "enquiry_departure_port_port_id_port_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."port"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_destination" ADD CONSTRAINT "enquiry_destination_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_destination" ADD CONSTRAINT "enquiry_destination_destination_id_destination_table_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_passenger" ADD CONSTRAINT "enquiry_passenger_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_resorts" ADD CONSTRAINT "enquiry_resorts_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_resorts" ADD CONSTRAINT "enquiry_resorts_resorts_id_resorts_table_id_fk" FOREIGN KEY ("resorts_id") REFERENCES "public"."resorts_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_holiday_type_id_package_type_table_id_fk" FOREIGN KEY ("holiday_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_accomodation_type_id_accomodation_type_id_fk" FOREIGN KEY ("accomodation_type_id") REFERENCES "public"."accomodation_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodges_table" ADD CONSTRAINT "lodges_table_park_id_park_table_id_fk" FOREIGN KEY ("park_id") REFERENCES "public"."park_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_lounge_pass_id_quote_lounge_pass_id_fk" FOREIGN KEY ("lounge_pass_id") REFERENCES "public"."quote_lounge_pass"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port" ADD CONSTRAINT "port_cruise_destination_id_cruise_destination_id_fk" FOREIGN KEY ("cruise_destination_id") REFERENCES "public"."cruise_destination"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_holiday_type_id_package_type_table_id_fk" FOREIGN KEY ("holiday_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_cottage_id_cottages_table_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_lodge_id_lodges_table_id_fk" FOREIGN KEY ("lodge_id") REFERENCES "public"."lodges_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_main_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("main_tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_board_basis_id_board_basis_id_fk" FOREIGN KEY ("board_basis_id") REFERENCES "public"."board_basis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_accomodation_id_accomodation_list_table_id_fk" FOREIGN KEY ("accomodation_id") REFERENCES "public"."accomodation_list_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_airport_parking" ADD CONSTRAINT "quote_airport_parking_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_airport_parking" ADD CONSTRAINT "quote_airport_parking_airport_id_airport_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_airport_parking" ADD CONSTRAINT "quote_airport_parking_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_attraction_ticket" ADD CONSTRAINT "quote_attraction_ticket_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_attraction_ticket" ADD CONSTRAINT "quote_attraction_ticket_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_car_hire" ADD CONSTRAINT "quote_car_hire_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_car_hire" ADD CONSTRAINT "quote_car_hire_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise" ADD CONSTRAINT "quote_cruise_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise" ADD CONSTRAINT "quote_cruise_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise_item_extra" ADD CONSTRAINT "quote_cruise_item_extra_cruise_extra_id_cruise_extra_item_table_id_fk" FOREIGN KEY ("cruise_extra_id") REFERENCES "public"."cruise_extra_item_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise_item_extra" ADD CONSTRAINT "quote_cruise_item_extra_quote_cruise_id_quote_cruise_id_fk" FOREIGN KEY ("quote_cruise_id") REFERENCES "public"."quote_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise_itinerary" ADD CONSTRAINT "quote_cruise_itinerary_quote_cruise_id_quote_cruise_id_fk" FOREIGN KEY ("quote_cruise_id") REFERENCES "public"."quote_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_departing_airport_id_airport_id_fk" FOREIGN KEY ("departing_airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_arrival_airport_id_airport_id_fk" FOREIGN KEY ("arrival_airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lounge_pass" ADD CONSTRAINT "quote_lounge_pass_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lounge_pass" ADD CONSTRAINT "quote_lounge_pass_airport_id_airport_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lounge_pass" ADD CONSTRAINT "quote_lounge_pass_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_transfers" ADD CONSTRAINT "quote_transfers_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_transfers" ADD CONSTRAINT "quote_transfers_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrerId_user_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_transactionId_transaction_id_fk" FOREIGN KEY ("transactionId") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_request" ADD CONSTRAINT "referral_request_referrerId_user_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_request" ADD CONSTRAINT "referral_request_clientId_client_table_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resorts_table" ADD CONSTRAINT "resorts_table_destination_id_destination_table_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_package_commission_table" ADD CONSTRAINT "tour_package_commission_table_package_type_id_package_type_table_id_fk" FOREIGN KEY ("package_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_package_commission_table" ADD CONSTRAINT "tour_package_commission_table_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_holiday_type_id_package_type_table_id_fk" FOREIGN KEY ("holiday_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_deal" ADD CONSTRAINT "travel_deal_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forwards_report_year_month_idx" ON "forwards_report" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "lodge_code_idx" ON "lodges_table" USING btree ("lodge_code");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");