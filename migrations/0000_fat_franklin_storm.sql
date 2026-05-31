CREATE TYPE "public"."booking_status_enum" AS ENUM('BOOKED', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."budget_type_enum" AS ENUM('PER_PERSON', 'PACKAGE');--> statement-breakpoint
CREATE TYPE "public"."enquiry_status_enum" AS ENUM('NEW_LEAD', 'ACTIVE', 'LOST', 'INACTIVE', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."feedback_status_enum" AS ENUM('open', 'in_review', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."feedback_type_enum" AS ENUM('suggestion', 'bug', 'general');--> statement-breakpoint
CREATE TYPE "public"."lead_source_enum" AS ENUM('SHOP', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM', 'PHONE_ENQUIRY');--> statement-breakpoint
CREATE TYPE "public"."owner_type_enum" AS ENUM('package_holiday', 'hot_tub_break', 'cruise');--> statement-breakpoint
CREATE TYPE "public"."quote_status_enum" AS ENUM('NEW_LEAD', 'QUOTE_IN_PROGRESS', 'QUOTE_CALL', 'QUOTE_READY', 'AWAITING_DECISION', 'REQUOTE', 'WON', 'ARCHIVED', 'LOST', 'INACTIVE', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."referral_payout_status_enum" AS ENUM('requested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."referral_request_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."referral_status_enum" AS ENUM('PENDING', 'IN_WALLET', 'PAID', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."referral_withdrawal_status_enum" AS ENUM('pending', 'processed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sms_auto_trigger" AS ENUM('manual', 'on_booking_create', 'on_pin_set', 'on_tickets_uploaded', 'days_before_departure', 'weekly_schedule');--> statement-breakpoint
CREATE TYPE "public"."sms_message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'skipped_optout', 'skipped_no_phone');--> statement-breakpoint
CREATE TYPE "public"."sms_template_category" AS ENUM('weekly_deals', 'balance_due', 'booking_confirmation', 'tickets_ready', 'portal_login', 'quote_link', 'custom');--> statement-breakpoint
CREATE TYPE "public"."transaction_status_enum" AS ENUM('on_enquiry', 'on_quote', 'in_play', 'on_booking');--> statement-breakpoint
CREATE TYPE "public"."vip_tier_enum" AS ENUM('standard', 'gold', 'elite');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_source_enum" AS ENUM('referral_commission', 'booking_credit', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_status_enum" AS ENUM('pending', 'processed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type_enum" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_method_enum" AS ENUM('bank_transfer', 'booking_credit');--> statement-breakpoint
CREATE TABLE "accommodation_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accommodation_id" uuid NOT NULL,
	"image_url" varchar NOT NULL,
	"isPrimary" boolean DEFAULT false,
	CONSTRAINT "accommodation_images_accommodation_id_image_url_unique" UNIQUE("accommodation_id","image_url")
);
--> statement-breakpoint
CREATE TABLE "accommodations" (
	"id" varchar PRIMARY KEY NOT NULL,
	"quote_id" varchar,
	"property" text,
	"board" text,
	"room_type" text,
	"notes" text
);
--> statement-breakpoint
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
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_org_id" uuid,
	"target_user_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_target_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"target_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_target_branch_user_year_month_unique" UNIQUE("branch_id","user_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "airport_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"airport_code" varchar NOT NULL,
	"airport_name" varchar NOT NULL,
	"country_id" uuid
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"entity_title" varchar,
	"entity_data" jsonb,
	"reason" text,
	"performed_by" varchar NOT NULL,
	"performed_by_name" varchar,
	"client_id" varchar,
	"client_name" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_basis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_table" (
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
	"wallet_credit" numeric(10, 2) DEFAULT '0.00',
	"num_of_nights" integer DEFAULT 0 NOT NULL,
	"pets" integer DEFAULT 0 NOT NULL,
	"cottage_id" uuid,
	"lodge_id" uuid,
	"lodge_type" varchar,
	"transfer_type" varchar,
	"infant" integer DEFAULT 0 NOT NULL,
	"child" integer DEFAULT 0 NOT NULL,
	"adult" integer DEFAULT 0 NOT NULL,
	"price_per_person" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"booking_status" "booking_status_enum",
	"main_tour_operator_id" uuid,
	"date_created" timestamp with time zone DEFAULT now(),
	"deletion_code" varchar,
	"deleted_by" uuid,
	"deleted_by_user" text,
	"deleted_at" timestamp (0) with time zone DEFAULT now(),
	CONSTRAINT "booking_table_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "booking_images" (
	"id" varchar PRIMARY KEY NOT NULL,
	"booking_id" uuid,
	"url" text,
	"is_primary" boolean
);
--> statement-breakpoint
CREATE TABLE "booking_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_tags_booking_id_tag_id_unique" UNIQUE("booking_id","tag_id")
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
CREATE TABLE "branch_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"org_role" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "branch_members_branch_id_user_id_unique" UNIQUE("branch_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"code" varchar,
	"address" text,
	"phone" varchar,
	"email" varchar,
	"opening_pattern" varchar,
	"bank_holidays_open" boolean DEFAULT false NOT NULL,
	"opening_hours" jsonb DEFAULT '[]',
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"branch_type" varchar(16) DEFAULT 'shop' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text DEFAULT 'direct' NOT NULL,
	"name" text,
	"created_by" text,
	"portal_client_id" uuid,
	"portal_client_name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" text NOT NULL,
	"content" text NOT NULL,
	"file_url" text,
	"file_name" text,
	"file_type" text,
	"file_size" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now(),
	"last_read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "client_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"title" text,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"category" text,
	"allocation_type" text,
	"allocation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
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
	"portal_pin" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"referrerId" text,
	"org_id" uuid,
	"branch_id" uuid,
	"created_by" text,
	"vipTier" "vip_tier_enum",
	"vipEnrolledAt" timestamp,
	"totalReferrals" integer DEFAULT 0 NOT NULL,
	"referredByClientId" uuid,
	"sms_opt_in" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "client_tags_client_id_tag_id_unique" UNIQUE("client_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY NOT NULL,
	"client_type" text,
	"title" text,
	"first_name" text,
	"last_name" text,
	"name" text,
	"email" text,
	"phone" text,
	"tier" text,
	"stage" text,
	"location" text,
	"house_number" text,
	"street" text,
	"city" text,
	"country" text,
	"postcode" text,
	"next_trip" text,
	"value" numeric,
	"last_touch" text,
	"tags" text[],
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"quote_id" varchar,
	"tour_operator" text,
	"price" numeric,
	"commission_percent" numeric,
	"commission_value" numeric,
	"agent_split_percent" numeric,
	"agent_split_value" numeric,
	"net_to_agency" numeric
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
CREATE TABLE "cruise_destination_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "cruise_extra_item_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "cruise_itenary_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ship_id" uuid,
	"itenary" varchar,
	"departure_port" varchar NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_line_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "ship_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar,
	"cruise_line_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cruise_voyage_table" (
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
CREATE TABLE "destination_guru" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"destination" text NOT NULL,
	"country" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "destination_guru_destination_unique" UNIQUE("destination")
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"email_address" text NOT NULL,
	"imap_host" text NOT NULL,
	"imap_port" integer DEFAULT 993 NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"secure" boolean DEFAULT true NOT NULL,
	"username" text NOT NULL,
	"encrypted_password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" varchar PRIMARY KEY NOT NULL,
	"client_id" varchar,
	"user_id" varchar,
	"enquiry_title" text,
	"holiday_type" text,
	"country" text,
	"destination" text,
	"resort" text,
	"departure_airport" text,
	"travel_date" text,
	"flexibility" text,
	"passengers_adults" integer,
	"passengers_children" integer,
	"passengers_infants" integer,
	"nights" integer,
	"star_rating" text,
	"board_basis" text,
	"budget" numeric,
	"budget_type" text,
	"status" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "enquiry_notes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"enquiry_id" varchar,
	"parent_id" varchar,
	"content" text,
	"author_name" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "facebook_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"page_id" text NOT NULL,
	"page_name" text NOT NULL,
	"page_category" text,
	"page_avatar" text,
	"encrypted_access_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
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
CREATE TABLE "feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"type" "feedback_type_enum" DEFAULT 'general' NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"status" "feedback_status_enum" DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"page" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flights_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flight_id" varchar,
	"flight_number" varchar,
	"flight_route" varchar,
	"departure_date" date,
	"departure_time" varchar,
	"arrival_date" date,
	"arrival_time" varchar,
	"departure_airport_id" uuid,
	"destination_airport_id" uuid
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
	"org_id" uuid,
	"branch_id" uuid,
	CONSTRAINT "forwards_report_year_month_unique" UNIQUE("year","month")
);
--> statement-breakpoint
CREATE TABLE "hr_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hr_record_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" varchar(32) DEFAULT 'Other' NOT NULL,
	"status" varchar(32) DEFAULT 'Uploaded' NOT NULL,
	"s3_key" text,
	"mime_type" text,
	"size" integer,
	"url" text,
	"expires_at" date,
	"uploaded_by" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hr_record_id" uuid NOT NULL,
	"type" varchar(16) NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"status" varchar(16) DEFAULT 'Pending' NOT NULL,
	"reason" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hr_record_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" varchar(32) DEFAULT 'Active' NOT NULL,
	"employment_type" varchar(32) DEFAULT 'Full-time' NOT NULL,
	"start_date" date,
	"probation_end" date,
	"manager_user_id" text,
	"salary" numeric(12, 2),
	"salary_currency" varchar(3),
	"contract_type" varchar(32),
	"contract_end_date" date,
	"holiday_allowance" integer,
	"tax_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_records_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "hub_announcement_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hub_announcement_likes_announcement_id_user_id_unique" UNIQUE("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hub_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text,
	"category" text DEFAULT 'general' NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"image_url" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hub_post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"author_name" varchar(255),
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hub_post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "hub_post_likes_post_id_user_id_unique" UNIQUE("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "hub_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"author_name" varchar(255),
	"type" varchar(50) DEFAULT 'deal' NOT NULL,
	"content" text NOT NULL,
	"image" text,
	"badge" varchar(100),
	"destination" varchar(255),
	"value" varchar(100),
	"pinned" boolean DEFAULT false,
	"likes" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lodge_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lodge_id" uuid NOT NULL,
	"image_url" varchar NOT NULL,
	"isPrimary" boolean DEFAULT false,
	CONSTRAINT "lodge_images_lodge_id_image_url_unique" UNIQUE("lodge_id","image_url")
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"parent_id" varchar,
	"transaction_id" uuid,
	"client_id" uuid
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
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"plan" varchar DEFAULT 'starter',
	"is_active" boolean DEFAULT true NOT NULL,
	"seat_limit" integer DEFAULT 10,
	"brand_color" varchar,
	"logo_url" varchar,
	"settings" jsonb DEFAULT '{}',
	"homeworker_commission" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"trial_ends_at" timestamp,
	"monthly_sms_credit_limit" integer DEFAULT 100 NOT NULL,
	"sms_overage_price_cents" integer DEFAULT 5 NOT NULL,
	"sms_credits_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
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
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"branch_limit" integer,
	"seat_limit" integer,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "port_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_destination_id" uuid,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE "portal_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"sender" varchar(10) NOT NULL,
	"agent_id" text,
	"agent_name" varchar(255),
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quote_table" (
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
	"is_expired" boolean DEFAULT false,
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
	"date_created" timestamp (0) with time zone DEFAULT now(),
	"date_expiry" timestamp (0) with time zone,
	"is_future_deal" boolean DEFAULT false,
	"future_deal_date" date,
	"is_active" boolean DEFAULT true,
	"deletion_code" varchar,
	"deleted_by" uuid,
	"deleted_by_v2" text,
	"deleted_at" timestamp (0) with time zone,
	"quote_ref" varchar,
	"isQuoteCopy" boolean DEFAULT false,
	"isFreeQuote" boolean DEFAULT false,
	"quote_token" varchar(12),
	"quote_sent_at" timestamp (0) with time zone,
	"quote_sent_via" varchar,
	"show_on_portal" boolean DEFAULT false,
	"is_featured" boolean DEFAULT false,
	"not_for_social" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "quote_customer_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"action_type" varchar(30) NOT NULL,
	"message" text,
	"customer_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_images" (
	"id" varchar PRIMARY KEY NOT NULL,
	"quote_id" uuid,
	"url" text,
	"is_primary" boolean
);
--> statement-breakpoint
CREATE TABLE "quote_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "quote_tags_quote_id_tag_id_unique" UNIQUE("quote_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "quote_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"device_type" varchar(20),
	"browser" varchar(100),
	"user_agent" text,
	"viewer_name" varchar(200)
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
	"leg_order" integer DEFAULT 0 NOT NULL,
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
CREATE TABLE "quotes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"client_id" uuid,
	"user_id" varchar,
	"status" text,
	"package_type" text,
	"quote_title" text,
	"destination" text,
	"travel_date" text,
	"return_date" text,
	"passengers_adults" integer,
	"passengers_children" integer,
	"child_ages" text[],
	"created_at" timestamp DEFAULT now(),
	"quote_link" text,
	"country" text,
	"resort" text,
	"passengers_infants" integer,
	"check_in_date" text,
	"check_in_time" text,
	"nights" integer,
	"transfer_type" text,
	"pre_booked_seats" text,
	"flight_meals" text,
	"lead_source" text,
	"hays_reference" text,
	"tour_reference" text,
	"booked_at" timestamp,
	"tags" text[]
);
--> statement-breakpoint
CREATE TABLE "referral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrerClientId" uuid,
	"referredClientId" uuid,
	"transactionId" uuid,
	"referredName" varchar NOT NULL,
	"referredEmail" varchar,
	"referredPhone" varchar,
	"referralStatus" "referral_status_enum" DEFAULT 'PENDING' NOT NULL,
	"commission" numeric,
	"payoutAmount" numeric,
	"travelDate" date,
	"payoutTriggerDate" date,
	"paidAt" timestamp,
	"payoutType" varchar,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referral_payout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" uuid NOT NULL,
	"client_id" uuid,
	"amount" numeric NOT NULL,
	"status" "referral_payout_status_enum" DEFAULT 'requested' NOT NULL,
	"notes" varchar,
	"requested_at" timestamp DEFAULT now(),
	"approved_at" timestamp,
	"rejected_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "referral_withdrawal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" uuid NOT NULL,
	"client_id" uuid,
	"amount" numeric NOT NULL,
	"method" "withdrawal_method_enum" NOT NULL,
	"status" "referral_withdrawal_status_enum" DEFAULT 'pending' NOT NULL,
	"account_name" varchar,
	"account_number" varchar,
	"sort_code" varchar,
	"transfer_reference" varchar,
	"booking_id" uuid,
	"credit_note" varchar,
	"notes" varchar,
	"invoice_url" text,
	"requested_at" timestamp DEFAULT now(),
	"processed_at" timestamp
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
CREATE TABLE "shop_target_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"target_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shop_target_branch_year_month_unique" UNIQUE("branch_id","year","month")
);
--> statement-breakpoint
CREATE TABLE "sms_credit_charge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sms_message_id" uuid,
	"period_start" date NOT NULL,
	"credits" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"invoiced_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_credit_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"credits_granted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sms_credit_usage_org_period_unique" UNIQUE("org_id","period_start")
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid,
	"template_name" varchar(200),
	"client_id" uuid,
	"client_name" varchar(255),
	"to_phone" varchar(30) NOT NULL,
	"body" text NOT NULL,
	"status" "sms_message_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" varchar(100),
	"provider_error" text,
	"cost_cents" integer,
	"triggered_by" text,
	"triggered_by_name" varchar(255),
	"trigger_source" varchar(50),
	"sent_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" "sms_template_category" DEFAULT 'custom' NOT NULL,
	"body" text NOT NULL,
	"auto_trigger" "sms_auto_trigger" DEFAULT 'manual' NOT NULL,
	"trigger_days_before" integer,
	"trigger_weekday" integer,
	"trigger_hour" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_used_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_name_unique" UNIQUE("name")
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"org_id" uuid,
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY NOT NULL,
	"entity_type" text,
	"entity_id" varchar,
	"user_id" varchar,
	"title" text,
	"due_date" timestamp,
	"completed" boolean,
	"completed_at" timestamp,
	"notified" boolean,
	"created_at" timestamp DEFAULT now(),
	"org_id" uuid,
	"branch_id" uuid
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
	"client_id" uuid,
	"user_id" text NOT NULL,
	"assigned_to" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"priority" text DEFAULT 'Medium' NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	"org_id" uuid,
	"branch_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tour_operators" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text,
	"holiday_type" text,
	"commission_percent" numeric,
	"username" text,
	"password" text,
	"contact" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"org_id" uuid
);
--> statement-breakpoint
CREATE TABLE "tour_operator_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar,
	"commission_percentage" numeric(5, 2),
	"org_id" uuid
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "transaction_status_enum",
	"is_active" boolean DEFAULT true,
	"is_test" boolean DEFAULT false,
	"client_id" uuid,
	"lead_source" "lead_source_enum" DEFAULT 'SHOP',
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"org_id" uuid,
	"branch_id" uuid
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
	"password" text,
	"resetToken" text,
	"resetTokenExpiry" timestamp,
	"inviteToken" text,
	"inviteTokenExpiry" timestamp,
	"invitedBy" text,
	"invitedAt" timestamp,
	"inviteAgencyName" text,
	"org_id" uuid,
	"org_role" varchar,
	"verification_token" text,
	"verification_token_expiry" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_org_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"granted_by" text,
	CONSTRAINT "user_org_roles_user_org_role_unique" UNIQUE("user_id","org_id","role")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bio" text,
	"extended_bio" text,
	"location" text,
	"specialisation" text,
	"certifications" text,
	"cover_image" text,
	"address" text,
	"emergency_contact_name" text,
	"emergency_contact_relationship" text,
	"emergency_contact_phone" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"role" text,
	"avatar" text,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wallet_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "wallet_transaction_type_enum" NOT NULL,
	"amount" numeric NOT NULL,
	"source" "wallet_transaction_source_enum" NOT NULL,
	"referral_id" uuid,
	"booking_id" uuid,
	"account_name" varchar,
	"account_number" varchar,
	"sort_code" varchar,
	"transfer_reference" varchar,
	"notes" text,
	"invoice_url" text,
	"status" "wallet_transaction_status_enum" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accommodation_images" ADD CONSTRAINT "accommodation_images_accommodation_id_accomodation_list_table_id_fk" FOREIGN KEY ("accommodation_id") REFERENCES "public"."accomodation_list_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accomodation_list_table" ADD CONSTRAINT "accomodation_list_table_type_id_accomodation_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."accomodation_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accomodation_list_table" ADD CONSTRAINT "accomodation_list_table_resorts_id_resorts_table_id_fk" FOREIGN KEY ("resorts_id") REFERENCES "public"."resorts_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_org_id_organization_id_fk" FOREIGN KEY ("target_org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_target_table" ADD CONSTRAINT "agent_target_table_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_target_table" ADD CONSTRAINT "agent_target_table_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "airport_table" ADD CONSTRAINT "airport_table_country_id_country_table_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_table" ADD CONSTRAINT "booking_table_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_table" ADD CONSTRAINT "booking_table_holiday_type_id_package_type_table_id_fk" FOREIGN KEY ("holiday_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_table" ADD CONSTRAINT "booking_table_cottage_id_cottages_table_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_table" ADD CONSTRAINT "booking_table_lodge_id_lodges_table_id_fk" FOREIGN KEY ("lodge_id") REFERENCES "public"."lodges_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_table" ADD CONSTRAINT "booking_table_main_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("main_tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_table" ADD CONSTRAINT "booking_table_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_images" ADD CONSTRAINT "booking_images_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_tags" ADD CONSTRAINT "booking_tags_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_tags" ADD CONSTRAINT "booking_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_board_basis_id_board_basis_id_fk" FOREIGN KEY ("board_basis_id") REFERENCES "public"."board_basis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_accomodation_id_accomodation_list_table_id_fk" FOREIGN KEY ("accomodation_id") REFERENCES "public"."accomodation_list_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_accomodation" ADD CONSTRAINT "booking_accomodation_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_airport_parking" ADD CONSTRAINT "booking_airport_parking_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_airport_parking" ADD CONSTRAINT "booking_airport_parking_airport_id_airport_table_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_airport_parking" ADD CONSTRAINT "booking_airport_parking_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attraction_ticket" ADD CONSTRAINT "booking_attraction_ticket_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attraction_ticket" ADD CONSTRAINT "booking_attraction_ticket_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_car_hire" ADD CONSTRAINT "booking_car_hire_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_car_hire" ADD CONSTRAINT "booking_car_hire_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise" ADD CONSTRAINT "booking_cruise_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise" ADD CONSTRAINT "booking_cruise_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise_item_extra" ADD CONSTRAINT "booking_cruise_item_extra_cruise_extra_id_cruise_extra_item_table_id_fk" FOREIGN KEY ("cruise_extra_id") REFERENCES "public"."cruise_extra_item_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise_item_extra" ADD CONSTRAINT "booking_cruise_item_extra_booking_cruise_id_booking_cruise_id_fk" FOREIGN KEY ("booking_cruise_id") REFERENCES "public"."booking_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_cruise_itinerary" ADD CONSTRAINT "booking_cruise_itinerary_booking_cruise_id_booking_cruise_id_fk" FOREIGN KEY ("booking_cruise_id") REFERENCES "public"."booking_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_departing_airport_id_airport_table_id_fk" FOREIGN KEY ("departing_airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_arrival_airport_id_airport_table_id_fk" FOREIGN KEY ("arrival_airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_flights" ADD CONSTRAINT "booking_flights_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lounge_pass" ADD CONSTRAINT "booking_lounge_pass_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lounge_pass" ADD CONSTRAINT "booking_lounge_pass_airport_id_airport_table_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_lounge_pass" ADD CONSTRAINT "booking_lounge_pass_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_transfers" ADD CONSTRAINT "booking_transfers_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_transfers" ADD CONSTRAINT "booking_transfers_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_members" ADD CONSTRAINT "branch_members_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_members" ADD CONSTRAINT "branch_members_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_members" ADD CONSTRAINT "branch_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_referrerId_user_id_fk" FOREIGN KEY ("referrerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_table" ADD CONSTRAINT "client_table_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tags" ADD CONSTRAINT "client_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_itenary_table" ADD CONSTRAINT "cruise_itenary_table_ship_id_ship_table_id_fk" FOREIGN KEY ("ship_id") REFERENCES "public"."ship_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_table" ADD CONSTRAINT "ship_table_cruise_line_id_cruise_line_table_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "public"."cruise_line_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_voyage_table" ADD CONSTRAINT "cruise_voyage_table_itinerary_id_cruise_itenary_table_id_fk" FOREIGN KEY ("itinerary_id") REFERENCES "public"."cruise_itenary_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "destination_table" ADD CONSTRAINT "destination_table_country_id_country_table_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."country_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_accomodation" ADD CONSTRAINT "enquiry_accomodation_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_accomodation" ADD CONSTRAINT "enquiry_accomodation_accomodation_id_accomodation_list_table_id_fk" FOREIGN KEY ("accomodation_id") REFERENCES "public"."accomodation_list_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_board_basis" ADD CONSTRAINT "enquiry_board_basis_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_board_basis" ADD CONSTRAINT "enquiry_board_basis_board_basis_id_board_basis_id_fk" FOREIGN KEY ("board_basis_id") REFERENCES "public"."board_basis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_destination" ADD CONSTRAINT "enquiry_cruise_destination_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_destination" ADD CONSTRAINT "enquiry_cruise_destination_cruise_destination_id_cruise_destination_table_id_fk" FOREIGN KEY ("cruise_destination_id") REFERENCES "public"."cruise_destination_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_line" ADD CONSTRAINT "enquiry_cruise_line_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_cruise_line" ADD CONSTRAINT "enquiry_cruise_line_cruise_line_id_cruise_line_table_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "public"."cruise_line_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_airport" ADD CONSTRAINT "enquiry_departure_airport_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_airport" ADD CONSTRAINT "enquiry_departure_airport_airport_id_airport_table_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_port" ADD CONSTRAINT "enquiry_departure_port_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_departure_port" ADD CONSTRAINT "enquiry_departure_port_port_id_port_table_id_fk" FOREIGN KEY ("port_id") REFERENCES "public"."port_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_destination" ADD CONSTRAINT "enquiry_destination_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_destination" ADD CONSTRAINT "enquiry_destination_destination_id_destination_table_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_passenger" ADD CONSTRAINT "enquiry_passenger_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_resorts" ADD CONSTRAINT "enquiry_resorts_enquiry_id_enquiry_table_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_resorts" ADD CONSTRAINT "enquiry_resorts_resorts_id_resorts_table_id_fk" FOREIGN KEY ("resorts_id") REFERENCES "public"."resorts_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_holiday_type_id_package_type_table_id_fk" FOREIGN KEY ("holiday_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_accomodation_type_id_accomodation_type_id_fk" FOREIGN KEY ("accomodation_type_id") REFERENCES "public"."accomodation_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_table" ADD CONSTRAINT "enquiry_table_deleted_by_user_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facebook_pages" ADD CONSTRAINT "facebook_pages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flights_table" ADD CONSTRAINT "flights_table_departure_airport_id_airport_table_id_fk" FOREIGN KEY ("departure_airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flights_table" ADD CONSTRAINT "flights_table_destination_airport_id_airport_table_id_fk" FOREIGN KEY ("destination_airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwards_report" ADD CONSTRAINT "forwards_report_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwards_report" ADD CONSTRAINT "forwards_report_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_hr_record_id_hr_records_id_fk" FOREIGN KEY ("hr_record_id") REFERENCES "public"."hr_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_documents" ADD CONSTRAINT "hr_documents_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leaves" ADD CONSTRAINT "hr_leaves_hr_record_id_hr_records_id_fk" FOREIGN KEY ("hr_record_id") REFERENCES "public"."hr_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_leaves" ADD CONSTRAINT "hr_leaves_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_notes" ADD CONSTRAINT "hr_notes_hr_record_id_hr_records_id_fk" FOREIGN KEY ("hr_record_id") REFERENCES "public"."hr_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_notes" ADD CONSTRAINT "hr_notes_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_manager_user_id_user_id_fk" FOREIGN KEY ("manager_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_announcement_likes" ADD CONSTRAINT "hub_announcement_likes_announcement_id_hub_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."hub_announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_announcement_likes" ADD CONSTRAINT "hub_announcement_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_comments" ADD CONSTRAINT "hub_post_comments_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_comments" ADD CONSTRAINT "hub_post_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_likes" ADD CONSTRAINT "hub_post_likes_post_id_hub_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."hub_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_post_likes" ADD CONSTRAINT "hub_post_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_posts" ADD CONSTRAINT "hub_posts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodge_images" ADD CONSTRAINT "lodge_images_lodge_id_lodges_table_id_fk" FOREIGN KEY ("lodge_id") REFERENCES "public"."lodges_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lodges_table" ADD CONSTRAINT "lodges_table_park_id_park_table_id_fk" FOREIGN KEY ("park_id") REFERENCES "public"."park_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_lounge_pass_id_quote_lounge_pass_id_fk" FOREIGN KEY ("lounge_pass_id") REFERENCES "public"."quote_lounge_pass"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_table" ADD CONSTRAINT "port_table_cruise_destination_id_cruise_destination_table_id_fk" FOREIGN KEY ("cruise_destination_id") REFERENCES "public"."cruise_destination_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_messages" ADD CONSTRAINT "portal_messages_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_messages" ADD CONSTRAINT "portal_messages_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_table" ADD CONSTRAINT "quote_table_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_table" ADD CONSTRAINT "quote_table_holiday_type_id_package_type_table_id_fk" FOREIGN KEY ("holiday_type_id") REFERENCES "public"."package_type_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_table" ADD CONSTRAINT "quote_table_cottage_id_cottages_table_id_fk" FOREIGN KEY ("cottage_id") REFERENCES "public"."cottages_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_table" ADD CONSTRAINT "quote_table_lodge_id_lodges_table_id_fk" FOREIGN KEY ("lodge_id") REFERENCES "public"."lodges_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_table" ADD CONSTRAINT "quote_table_main_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("main_tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_table" ADD CONSTRAINT "quote_table_deleted_by_v2_user_id_fk" FOREIGN KEY ("deleted_by_v2") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_customer_actions" ADD CONSTRAINT "quote_customer_actions_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_images" ADD CONSTRAINT "quote_images_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_tags" ADD CONSTRAINT "quote_tags_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_tags" ADD CONSTRAINT "quote_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_views" ADD CONSTRAINT "quote_views_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_board_basis_id_board_basis_id_fk" FOREIGN KEY ("board_basis_id") REFERENCES "public"."board_basis"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_accomodation_id_accomodation_list_table_id_fk" FOREIGN KEY ("accomodation_id") REFERENCES "public"."accomodation_list_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_accomodation" ADD CONSTRAINT "quote_accomodation_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_airport_parking" ADD CONSTRAINT "quote_airport_parking_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_airport_parking" ADD CONSTRAINT "quote_airport_parking_airport_id_airport_table_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_airport_parking" ADD CONSTRAINT "quote_airport_parking_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_attraction_ticket" ADD CONSTRAINT "quote_attraction_ticket_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_attraction_ticket" ADD CONSTRAINT "quote_attraction_ticket_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_car_hire" ADD CONSTRAINT "quote_car_hire_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_car_hire" ADD CONSTRAINT "quote_car_hire_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise" ADD CONSTRAINT "quote_cruise_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise" ADD CONSTRAINT "quote_cruise_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise_item_extra" ADD CONSTRAINT "quote_cruise_item_extra_cruise_extra_id_cruise_extra_item_table_id_fk" FOREIGN KEY ("cruise_extra_id") REFERENCES "public"."cruise_extra_item_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise_item_extra" ADD CONSTRAINT "quote_cruise_item_extra_quote_cruise_id_quote_cruise_id_fk" FOREIGN KEY ("quote_cruise_id") REFERENCES "public"."quote_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_cruise_itinerary" ADD CONSTRAINT "quote_cruise_itinerary_quote_cruise_id_quote_cruise_id_fk" FOREIGN KEY ("quote_cruise_id") REFERENCES "public"."quote_cruise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_departing_airport_id_airport_table_id_fk" FOREIGN KEY ("departing_airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_arrival_airport_id_airport_table_id_fk" FOREIGN KEY ("arrival_airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_flights" ADD CONSTRAINT "quote_flights_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lounge_pass" ADD CONSTRAINT "quote_lounge_pass_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lounge_pass" ADD CONSTRAINT "quote_lounge_pass_airport_id_airport_table_id_fk" FOREIGN KEY ("airport_id") REFERENCES "public"."airport_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lounge_pass" ADD CONSTRAINT "quote_lounge_pass_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_transfers" ADD CONSTRAINT "quote_transfers_tour_operator_id_tour_operator_table_id_fk" FOREIGN KEY ("tour_operator_id") REFERENCES "public"."tour_operator_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_transfers" ADD CONSTRAINT "quote_transfers_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referrerClientId_client_table_id_fk" FOREIGN KEY ("referrerClientId") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_referredClientId_client_table_id_fk" FOREIGN KEY ("referredClientId") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral" ADD CONSTRAINT "referral_transactionId_transaction_id_fk" FOREIGN KEY ("transactionId") REFERENCES "public"."transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payout" ADD CONSTRAINT "referral_payout_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_payout" ADD CONSTRAINT "referral_payout_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_withdrawal" ADD CONSTRAINT "referral_withdrawal_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_withdrawal" ADD CONSTRAINT "referral_withdrawal_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_withdrawal" ADD CONSTRAINT "referral_withdrawal_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resorts_table" ADD CONSTRAINT "resorts_table_destination_id_destination_table_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_target_table" ADD CONSTRAINT "shop_target_table_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_credit_charge" ADD CONSTRAINT "sms_credit_charge_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_credit_charge" ADD CONSTRAINT "sms_credit_charge_sms_message_id_sms_messages_id_fk" FOREIGN KEY ("sms_message_id") REFERENCES "public"."sms_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_credit_usage" ADD CONSTRAINT "sms_credit_usage_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_template_id_sms_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sms_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_triggered_by_user_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_agent_id_user_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assigned_by_id_user_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_operators" ADD CONSTRAINT "tour_operators_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_operator_table" ADD CONSTRAINT "tour_operator_table_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_deal" ADD CONSTRAINT "travel_deal_quote_id_quote_table_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_org_roles" ADD CONSTRAINT "user_org_roles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_org_roles" ADD CONSTRAINT "user_org_roles_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_org_roles" ADD CONSTRAINT "user_org_roles_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_referral_id_referral_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referral"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transaction" ADD CONSTRAINT "wallet_transaction_booking_id_booking_table_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_client_id_client_table_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_audit_actor" ON "admin_audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_target_org" ON "admin_audit_log" USING btree ("target_org_id");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_branch_members_org_id" ON "branch_members" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_branch_members_branch_id" ON "branch_members" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "idx_branch_members_user_id" ON "branch_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_branches_org_id" ON "branches" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "forwards_report_year_month_idx" ON "forwards_report" USING btree ("year","month");--> statement-breakpoint
CREATE INDEX "idx_hr_documents_hr_record_id" ON "hr_documents" USING btree ("hr_record_id");--> statement-breakpoint
CREATE INDEX "idx_hr_documents_category" ON "hr_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_hr_documents_expires_at" ON "hr_documents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_hr_leaves_hr_record_id" ON "hr_leaves" USING btree ("hr_record_id");--> statement-breakpoint
CREATE INDEX "idx_hr_leaves_status" ON "hr_leaves" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_hr_leaves_from_date" ON "hr_leaves" USING btree ("from_date");--> statement-breakpoint
CREATE INDEX "idx_hr_notes_hr_record_id" ON "hr_notes" USING btree ("hr_record_id");--> statement-breakpoint
CREATE INDEX "idx_hr_notes_created_at" ON "hr_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_hr_records_org_id" ON "hr_records" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_hr_records_manager_user_id" ON "hr_records" USING btree ("manager_user_id");--> statement-breakpoint
CREATE INDEX "lodge_code_idx" ON "lodges_table" USING btree ("lodge_code");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_sms_credit_charge_org_status" ON "sms_credit_charge" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "idx_sms_credit_charge_period" ON "sms_credit_charge" USING btree ("org_id","period_start");--> statement-breakpoint
CREATE INDEX "idx_sms_credit_usage_org_period" ON "sms_credit_usage" USING btree ("org_id","period_start");--> statement-breakpoint
CREATE INDEX "idx_sms_templates_org_id" ON "sms_templates" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_user_org_roles_user" ON "user_org_roles" USING btree ("user_id","org_id");--> statement-breakpoint
CREATE INDEX "idx_user_org_roles_org" ON "user_org_roles" USING btree ("org_id");