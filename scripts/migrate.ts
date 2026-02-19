import pg from "pg";

let dbUrl = process.env.DATABASE_URL || "";
if (dbUrl.startsWith("psql ")) {
  dbUrl = dbUrl.replace(/^psql\s+'?/, "").replace(/'$/, "");
}

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Phase 1: Create new enums (if they don't exist)
    const enums = [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status_enum') THEN CREATE TYPE "transaction_status_enum" AS ENUM('on_enquiry', 'on_quote', 'on_booking'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_source_enum') THEN CREATE TYPE "lead_source_enum" AS ENUM('SHOP', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM', 'PHONE_ENQUIRY'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enquiry_status_enum') THEN CREATE TYPE "enquiry_status_enum" AS ENUM('NEW_LEAD', 'ACTIVE', 'LOST', 'INACTIVE', 'EXPIRED'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_type_enum') THEN CREATE TYPE "budget_type_enum" AS ENUM('PER_PERSON', 'PACKAGE'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status_enum') THEN CREATE TYPE "quote_status_enum" AS ENUM('NEW_LEAD', 'QUOTE_IN_PROGRESS', 'QUOTE_CALL', 'QUOTE_READY', 'AWAITING_DECISION', 'REQUOTE', 'WON', 'ARCHIVED', 'LOST', 'INACTIVE', 'EXPIRED'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status_enum') THEN CREATE TYPE "booking_status_enum" AS ENUM('BOOKED', 'LOST'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status_enum') THEN CREATE TYPE "referral_status_enum" AS ENUM('PENDING', 'RELEASED', 'REJECTED'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_request_status_enum') THEN CREATE TYPE "referral_request_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED'); END IF; END $$`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'owner_type_enum') THEN CREATE TYPE "owner_type_enum" AS ENUM('package_holiday', 'hot_tub_break', 'cruise'); END IF; END $$`,
    ];

    console.log("Creating enums...");
    for (const sql of enums) {
      await client.query(sql);
    }
    console.log("✓ Enums created");

    // Phase 2: Create user table (auth)
    console.log("Creating user table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" text PRIMARY KEY,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "emailVerified" boolean NOT NULL DEFAULT false,
        "image" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "role" text NOT NULL,
        "banned" boolean DEFAULT false,
        "banReason" text,
        "banExpires" timestamp,
        "firstName" text NOT NULL,
        "lastName" text NOT NULL,
        "phoneNumber" text NOT NULL,
        "orgName" text,
        "percentageCommission" integer
      )
    `);
    console.log("✓ user table created");

    // Phase 3: New airport table with UUID PK
    console.log("Creating airport table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "airport" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "airport_code" varchar NOT NULL,
        "airport_name" varchar NOT NULL,
        "country_id" uuid REFERENCES "country_table"("id")
      )
    `);
    console.log("✓ airport table created");

    // Phase 4: Cruise lookup tables
    console.log("Creating cruise lookup tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "cruise_line" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "cruise_destination" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "cruise_ship" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar,
        "cruise_line_id" uuid REFERENCES "cruise_line"("id") ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "cruise_itenary" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "ship_id" uuid REFERENCES "cruise_ship"("id") ON DELETE CASCADE,
        "itenary" varchar,
        "departure_port" varchar NOT NULL,
        "date" date NOT NULL
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "cruise_voyage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "itinerary_id" uuid REFERENCES "cruise_itenary"("id") ON DELETE CASCADE,
        "day_number" numeric,
        "description" varchar
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "port" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cruise_destination_id" uuid REFERENCES "cruise_destination"("id"),
        "name" varchar
      )
    `);
    console.log("✓ Cruise lookup tables created");

    // Phase 5: Transaction table
    console.log("Creating transaction table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "transaction" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "status" "transaction_status_enum",
        "is_active" boolean DEFAULT true,
        "client_id" uuid REFERENCES "client_table"("id"),
        "holiday_type_id" uuid REFERENCES "package_type_table"("id"),
        "agent_id" text REFERENCES "user"("id"),
        "lead_source" "lead_source_enum" DEFAULT 'SHOP',
        "user_id" text NOT NULL REFERENCES "user"("id"),
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✓ transaction table created");

    // Phase 6: Enquiry table
    console.log("Creating enquiry tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_table" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL UNIQUE REFERENCES "transaction"("id") ON DELETE CASCADE,
        "holiday_type_id" uuid NOT NULL REFERENCES "package_type_table"("id"),
        "accomodation_type_id" uuid REFERENCES "accomodation_type"("id"),
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
        "max_budget" numeric DEFAULT 0.00,
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
        "deleted_by" text REFERENCES "user"("id"),
        "deleted_at" timestamp with time zone,
        "email" varchar
      )
    `);

    // Enquiry junction tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_destination" (
        "destination_id" uuid REFERENCES "destination_table"("id"),
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_resorts" (
        "resorts_id" uuid REFERENCES "resorts_table"("id"),
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_accomodation" (
        "accomodation_id" uuid REFERENCES "accomodation_list_table"("id"),
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_board_basis" (
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE,
        "board_basis_id" uuid REFERENCES "board_basis"("id")
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_departure_airport" (
        "airport_id" uuid REFERENCES "airport"("id"),
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_departure_port" (
        "port_id" uuid REFERENCES "port"("id"),
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_cruise_line" (
        "cruise_line_id" uuid REFERENCES "cruise_line"("id"),
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_cruise_destination" (
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE,
        "cruise_destination_id" uuid REFERENCES "cruise_destination"("id")
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "enquiry_passenger" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "enquiry_id" uuid REFERENCES "enquiry_table"("id") ON DELETE CASCADE,
        "type" varchar,
        "age" integer
      )
    `);
    console.log("✓ Enquiry tables created");

    // Phase 7: Quote table
    console.log("Creating quote tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL REFERENCES "transaction"("id") ON DELETE CASCADE,
        "deal_id" varchar,
        "holiday_type_id" uuid NOT NULL REFERENCES "package_type_table"("id"),
        "sales_price" numeric(10,2),
        "package_commission" numeric(10,2),
        "travel_date" date NOT NULL,
        "discounts" numeric(10,2),
        "service_charge" numeric(10,2),
        "num_of_nights" integer NOT NULL DEFAULT 0,
        "pets" integer NOT NULL DEFAULT 0,
        "cottage_id" uuid REFERENCES "cottages_table"("id"),
        "lodge_id" uuid REFERENCES "lodges_table"("id"),
        "quote_type" varchar NOT NULL,
        "deal_type" varchar,
        "pre_booked_seats" varchar,
        "flight_meals" boolean DEFAULT false,
        "infant" integer,
        "child" integer,
        "adult" integer,
        "title" varchar,
        "price_per_person" numeric(10,2) NOT NULL DEFAULT 0.00,
        "lodge_type" varchar,
        "transfer_type" varchar NOT NULL DEFAULT 'none',
        "quote_status" "quote_status_enum",
        "main_tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "date_created" timestamp with time zone DEFAULT now(),
        "date_expiry" timestamp with time zone,
        "is_future_deal" boolean DEFAULT false,
        "future_deal_date" date,
        "is_active" boolean DEFAULT true,
        "deletion_code" varchar,
        "deleted_by" text REFERENCES "user"("id"),
        "deleted_at" timestamp with time zone,
        "quote_ref" varchar,
        "isQuoteCopy" boolean DEFAULT false,
        "isFreeQuote" boolean DEFAULT false
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_flights" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE,
        "flight_number" varchar,
        "flight_ref" varchar,
        "departing_airport_id" uuid REFERENCES "airport"("id"),
        "arrival_airport_id" uuid REFERENCES "airport"("id"),
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "flight_type" varchar,
        "departure_date_time" timestamp,
        "arrival_date_time" timestamp,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_accomodation" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "no_of_nights" integer NOT NULL DEFAULT 0,
        "room_type" varchar,
        "board_basis_id" uuid REFERENCES "board_basis"("id"),
        "check_in_date_time" timestamp(6) with time zone,
        "stay_type" varchar,
        "is_primary" boolean DEFAULT false,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "accomodation_id" uuid REFERENCES "accomodation_list_table"("id"),
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_transfers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "pick_up_location" varchar,
        "drop_off_location" varchar,
        "pick_up_time" timestamp,
        "drop_off_time" timestamp,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE,
        "note" varchar
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_car_hire" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE,
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "pick_up_location" varchar,
        "drop_off_location" varchar,
        "pick_up_time" timestamp,
        "drop_off_time" timestamp,
        "no_of_days" integer NOT NULL DEFAULT 0,
        "driver_age" integer NOT NULL DEFAULT 0,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_attraction_ticket" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE,
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "ticket_type" varchar,
        "date_of_visit" timestamp,
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "number_of_tickets" integer NOT NULL DEFAULT 0,
        "is_included_in_package" boolean
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_lounge_pass" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE,
        "booking_ref" varchar,
        "terminal" varchar,
        "airport_id" uuid REFERENCES "airport"("id"),
        "date_of_usage" timestamp,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "is_included_in_package" boolean,
        "note" varchar
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_airport_parking" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_ref" varchar,
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE,
        "airport_id" uuid REFERENCES "airport"("id"),
        "parking_type" varchar,
        "parking_date" timestamp,
        "car_make" varchar,
        "car_model" varchar,
        "colour" varchar,
        "car_reg_number" varchar,
        "duration" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_cruise" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "cruise_line" varchar,
        "ship" varchar,
        "cruise_date" date,
        "cabin_type" varchar,
        "cruise_name" varchar,
        "pre_cruise_stay" integer NOT NULL,
        "post_cruise_stay" integer NOT NULL,
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_cruise_item_extra" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cruise_extra_id" uuid REFERENCES "cruise_extra_item_table"("id"),
        "quote_cruise_id" uuid REFERENCES "quote_cruise"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_cruise_itinerary" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "quote_cruise_id" uuid REFERENCES "quote_cruise"("id") ON DELETE CASCADE,
        "day_number" integer,
        "description" varchar
      )
    `);

    // Drop quote_images table if it exists with wrong foreign key
    await client.query(`DROP TABLE IF EXISTS "quote_images" CASCADE`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_images" (
        "id" varchar PRIMARY KEY,
        "quote_id" uuid,
        "url" text,
        "is_primary" boolean,
        CONSTRAINT "quote_images_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote_table"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "quote_images_quote_id_idx" ON "quote_images" ("quote_id")
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL UNIQUE,
        "usage_count" integer NOT NULL DEFAULT 0,
        "created_at" timestamp with time zone DEFAULT now(),
        "last_used_at" timestamp with time zone DEFAULT now()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "tags_name_idx" ON "tags" ("name")
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "quote_tags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "quote_id" uuid NOT NULL REFERENCES "quote_table"("id") ON DELETE CASCADE,
        "tag_id" uuid NOT NULL REFERENCES "tags"("id") ON DELETE CASCADE,
        "created_at" timestamp with time zone DEFAULT now(),
        UNIQUE("quote_id", "tag_id")
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "quote_tags_quote_id_idx" ON "quote_tags" ("quote_id")
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS "quote_tags_tag_id_idx" ON "quote_tags" ("tag_id")
    `);

    await client.query(`
      ALTER TABLE "quote_table" DROP COLUMN IF EXISTS "tags"
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "travel_deal" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "subtitle" varchar,
        "post" text NOT NULL,
        "resortSummary" varchar,
        "hashtags" text[] NOT NULL DEFAULT ARRAY[]::text[],
        "travelDate" date,
        "nights" integer NOT NULL,
        "boardBasis" varchar,
        "departureAirport" varchar,
        "postSchedule" timestamp with time zone,
        "onlySocialsId" varchar,
        "luggageTransfers" varchar,
        "price" numeric(10,2),
        "quote_id" uuid NOT NULL REFERENCES "quote"("id") ON DELETE CASCADE,
        "created_at" timestamp with time zone DEFAULT now()
      )
    `);
    console.log("✓ Quote tables created");

    // Phase 8: Booking table
    console.log("Creating booking tables...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL UNIQUE REFERENCES "transaction"("id") ON DELETE CASCADE,
        "deal_type" varchar,
        "pre_booked_seats" varchar,
        "flight_meals" boolean DEFAULT false,
        "holiday_type_id" uuid NOT NULL REFERENCES "package_type_table"("id"),
        "hays_ref" varchar NOT NULL,
        "supplier_ref" varchar NOT NULL,
        "is_active" boolean DEFAULT true,
        "sales_price" numeric(10,2),
        "package_commission" numeric(10,2),
        "travel_date" date NOT NULL,
        "title" varchar,
        "discounts" numeric(10,2),
        "service_charge" numeric(10,2),
        "num_of_nights" integer NOT NULL DEFAULT 0,
        "pets" integer NOT NULL DEFAULT 0,
        "cottage_id" uuid REFERENCES "cottages_table"("id"),
        "lodge_id" uuid REFERENCES "lodges_table"("id"),
        "lodge_type" varchar,
        "transfer_type" varchar,
        "infant" integer NOT NULL DEFAULT 0,
        "child" integer NOT NULL DEFAULT 0,
        "adult" integer NOT NULL DEFAULT 0,
        "booking_status" "booking_status_enum",
        "main_tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "date_created" timestamp with time zone DEFAULT now(),
        "deletion_code" varchar,
        "deleted_by" text REFERENCES "user"("id"),
        "deleted_at" timestamp with time zone DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "passengers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar,
        "age" integer NOT NULL DEFAULT 0,
        "quote_id" uuid REFERENCES "quote"("id") ON DELETE CASCADE,
        "lounge_pass_id" uuid REFERENCES "quote_lounge_pass"("id") ON DELETE CASCADE,
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_flights" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE,
        "flight_number" varchar,
        "flight_ref" varchar,
        "departing_airport_id" uuid REFERENCES "airport"("id"),
        "arrival_airport_id" uuid REFERENCES "airport"("id"),
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "flight_type" varchar,
        "departure_date_time" timestamp,
        "arrival_date_time" timestamp,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_accomodation" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "no_of_nights" integer NOT NULL DEFAULT 0,
        "room_type" varchar,
        "board_basis_id" uuid REFERENCES "board_basis"("id"),
        "check_in_date_time" timestamp,
        "stay_type" varchar,
        "is_primary" boolean DEFAULT false,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "accomodation_id" uuid REFERENCES "accomodation_list_table"("id"),
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_transfers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "pick_up_location" varchar,
        "drop_off_location" varchar,
        "pick_up_time" timestamp,
        "drop_off_time" timestamp,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE,
        "note" varchar
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_car_hire" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE,
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "pick_up_location" varchar,
        "drop_off_location" varchar,
        "pick_up_time" timestamp,
        "drop_off_time" timestamp,
        "no_of_days" integer,
        "driver_age" integer,
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_attraction_ticket" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE,
        "booking_ref" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "ticket_type" varchar,
        "date_of_visit" timestamp,
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "number_of_tickets" integer,
        "is_included_in_package" boolean
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_lounge_pass" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE,
        "booking_ref" varchar,
        "terminal" varchar,
        "airport_id" uuid REFERENCES "airport"("id"),
        "date_of_usage" timestamp,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "cost" numeric(10,2),
        "commission" numeric(10,2),
        "is_included_in_package" boolean,
        "note" varchar
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_airport_parking" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_ref" varchar,
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE,
        "airport_id" uuid REFERENCES "airport"("id"),
        "parking_type" varchar,
        "parking_date" timestamp,
        "car_make" varchar,
        "car_model" varchar,
        "colour" varchar,
        "car_reg_number" varchar,
        "duration" varchar,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "is_included_in_package" boolean,
        "cost" numeric(10,2),
        "commission" numeric(10,2)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_cruise" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_id" uuid REFERENCES "booking"("id") ON DELETE CASCADE,
        "tour_operator_id" uuid REFERENCES "tour_operator_table"("id"),
        "cruise_line" varchar,
        "ship" varchar,
        "cruise_date" date,
        "cabin_type" varchar,
        "cruise_name" varchar,
        "pre_cruise_stay" integer,
        "post_cruise_stay" integer
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_cruise_item_extra" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "cruise_extra_id" uuid REFERENCES "cruise_extra_item_table"("id"),
        "booking_cruise_id" uuid REFERENCES "booking_cruise"("id") ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "booking_cruise_itinerary" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "booking_cruise_id" uuid REFERENCES "booking_cruise"("id") ON DELETE CASCADE,
        "day_number" integer,
        "description" varchar
      )
    `);
    console.log("✓ Booking tables created");

    // Phase 9: Transaction-level children
    console.log("Creating transaction-level children...");

    // Notes: alter existing table to add transaction_id if needed, or create new
    // Since the existing notes table has different structure, we'll handle carefully
    // Check if notes table already has transaction_id
    const notesCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'notes' AND column_name = 'transaction_id'
    `);
    if (notesCheck.rows.length === 0) {
      // Add new columns to existing notes table
      await client.query(`ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "description" varchar`);
      await client.query(`ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "agent_id" text REFERENCES "user"("id")`);
      await client.query(`ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "user_id" text REFERENCES "user"("id")`);
      await client.query(`ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "transaction_id" uuid REFERENCES "transaction"("id") ON DELETE CASCADE`);
      // Make quote_id nullable for transition period
      await client.query(`ALTER TABLE "notes" ALTER COLUMN "quote_id" DROP NOT NULL`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS "task" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" text REFERENCES "user"("id") ON DELETE SET NULL,
        "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
        "client_id" uuid REFERENCES "client_table"("id") ON DELETE SET NULL,
        "assigned_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
        "transaction_id" uuid REFERENCES "transaction"("id") ON DELETE CASCADE,
        "deal_id" varchar,
        "transaction_type" varchar,
        "title" varchar,
        "type" varchar DEFAULT 'task',
        "task" varchar,
        "due_date" timestamp,
        "number" varchar,
        "priority" varchar,
        "status" varchar,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "referral" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "referrerId" text REFERENCES "user"("id") ON DELETE SET NULL,
        "transactionId" uuid REFERENCES "transaction"("id") ON DELETE CASCADE,
        "referralStatus" "referral_status_enum" DEFAULT 'PENDING',
        "potentialCommission" numeric,
        "commission" numeric,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "referral_request" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "referrerId" text REFERENCES "user"("id") ON DELETE CASCADE,
        "referredStatus" "referral_request_status_enum" DEFAULT 'PENDING',
        "notes" varchar,
        "createdAt" timestamp DEFAULT now(),
        "updatedAt" timestamp DEFAULT now(),
        "clientId" uuid REFERENCES "client_table"("id") ON DELETE CASCADE
      )
    `);
    console.log("✓ Transaction children created");

    // Phase 10: Alter client_table to add referrerId FK if not exists
    console.log("Checking client_table referrerId FK...");
    const fkCheck = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'client_table' AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%referrer%'
    `);
    if (fkCheck.rows.length === 0) {
      // First clear any invalid referrerId values
      await client.query(`UPDATE "client_table" SET "referrerId" = NULL WHERE "referrerId" IS NOT NULL AND "referrerId" NOT IN (SELECT "id" FROM "user")`);
      await client.query(`ALTER TABLE "client_table" ADD CONSTRAINT "client_table_referrerId_fk" FOREIGN KEY ("referrerId") REFERENCES "user"("id") ON DELETE SET NULL`).catch(() => {
        console.log("  Note: referrerId FK could not be added (user table may be empty)");
      });
    }
    console.log("✓ Client table FK checked");

    await client.query("COMMIT");
    console.log("\n✅ Migration completed successfully!");

    // Verify tables
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log(`\nTotal tables in database: ${result.rows.length}`);
    console.log("Tables:", result.rows.map((r: any) => r.table_name).join(", "));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
