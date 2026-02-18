import { sql, relations } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, integer, decimal, numeric, timestamp, boolean, index, jsonb, uuid, date, unique, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transaction_status_enum = pgEnum('transaction_status_enum', ['on_enquiry', 'on_quote', 'on_booking']);
export const lead_source_enum = pgEnum('lead_source_enum', ['SHOP', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM', 'PHONE_ENQUIRY']);
export const enquiry_status_enum = pgEnum('enquiry_status_enum', ['NEW_LEAD', 'ACTIVE', 'LOST', 'INACTIVE', 'EXPIRED']);
export const budget_type_enum = pgEnum('budget_type_enum', ['PER_PERSON', 'PACKAGE']);
export const quote_status_enum = pgEnum('quote_status_enum', ['NEW_LEAD', 'QUOTE_IN_PROGRESS', 'QUOTE_CALL', 'QUOTE_READY', 'AWAITING_DECISION', 'REQUOTE', 'WON', 'ARCHIVED', 'LOST', 'INACTIVE', 'EXPIRED']);
export const booking_status_enum = pgEnum('booking_status_enum', ['BOOKED', 'LOST']);
export const referral_status_enum = pgEnum('referral_status_enum', ['PENDING', 'RELEASED', 'REJECTED']);
export const referral_request_status_enum = pgEnum('referral_request_status_enum', ['PENDING', 'APPROVED', 'REJECTED']);
export const owner_type_enum = pgEnum('owner_type_enum', ['package_holiday', 'hot_tub_break', 'cruise']);

export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
}, (table) => [index("IDX_session_expire").on(table.expire)]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  role: text("role").notNull(),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
  firstName: text("firstName").notNull(),
  lastName: text("lastName").notNull(),
  phoneNumber: text("phoneNumber").notNull(),
  orgName: text("orgName"),
  percentageCommission: integer("percentageCommission"),
});

export const insertUserSchema = createInsertSchema(user).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof user.$inferInsert;
export type User = typeof user.$inferSelect;

export const clientTable = pgTable("client_table", {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  title: varchar(),
  firstName: varchar().notNull(),
  surename: varchar().notNull(),
  DOB: date({ mode: "string" }),
  phoneNumber: varchar().notNull(),
  email: varchar(),
  emailIsAllowed: boolean(),
  VMB: varchar(),
  VMBfirstAccess: varchar(),
  whatsAppVerified: boolean().notNull().default(false),
  mailAllowed: boolean().default(false),
  houseNumber: varchar(),
  city: varchar(),
  street: varchar(),
  country: varchar(),
  post_code: varchar(),
  avatarUrl: varchar(),
  badge: varchar(),
  createdAt: timestamp().notNull().defaultNow(),
  referrerId: text("referrerId").references(() => user.id, { onDelete: "set null" }),
});

export const insertClientTableSchema = createInsertSchema(clientTable).omit({ id: true, createdAt: true });
export type InsertClientTable = z.infer<typeof insertClientTableSchema>;
export type NeonClient = typeof clientTable.$inferSelect;

export const accomodation_type = pgTable('accomodation_type', {
  id: uuid('id')
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  type: varchar(),
});
export type AccomodationType = typeof accomodation_type.$inferSelect;
export type InsertAccomodationType = typeof accomodation_type.$inferInsert;

export const board_basis = pgTable('board_basis', {
  id: uuid('id')
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  type: varchar().notNull(),
});
export type BoardBasis = typeof board_basis.$inferSelect;
export type InsertBoardBasis = typeof board_basis.$inferInsert;

export const country = pgTable('country_table', {
  id: uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  country_name: varchar().notNull(),
  country_code: varchar(),
});
export type Country = typeof country.$inferSelect;
export type InsertCountry = typeof country.$inferInsert;

export const destination = pgTable('destination_table', {
  id: uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: varchar().notNull(),
  type: varchar(),
  country_id: uuid().references(() => country.id),
});
export type Destination = typeof destination.$inferSelect;
export type InsertDestination = typeof destination.$inferInsert;

export const resorts = pgTable('resorts_table', {
  id: uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: varchar().notNull(),
  destination_id: uuid().references(() => destination.id),
});
export type Resort = typeof resorts.$inferSelect;
export type InsertResort = typeof resorts.$inferInsert;

export const accomodation_list = pgTable('accomodation_list_table', {
  id: uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  type_id: uuid().references(() => accomodation_type.id),
  name: varchar().notNull(),
  resorts_id: uuid().references(() => resorts.id),
  description: varchar(),
});
export type AccomodationList = typeof accomodation_list.$inferSelect;
export type InsertAccomodationList = typeof accomodation_list.$inferInsert;

export const tour_operator = pgTable('tour_operator_table', {
  id: uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: varchar(),
});
export type TourOperatorLookup = typeof tour_operator.$inferSelect;
export type InsertTourOperatorLookup = typeof tour_operator.$inferInsert;

export const package_type = pgTable('package_type_table', {
  id: uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: varchar().notNull(),
});
export type PackageType = typeof package_type.$inferSelect;
export type InsertPackageType = typeof package_type.$inferInsert;

export const tour_package_commission = pgTable(
  'tour_package_commission_table',
  {
    package_type_id: uuid().references(() => package_type.id),
    tour_operator_id: uuid().references(() => tour_operator.id),
    percentage_commission: decimal({ precision: 5, scale: 2 }),
  },
  (table) => [primaryKey({ name: 'id', columns: [table.package_type_id, table.tour_operator_id] })]
);
export type TourPackageCommission = typeof tour_package_commission.$inferSelect;
export type InsertTourPackageCommission = typeof tour_package_commission.$inferInsert;

export const park = pgTable('park_table', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar(),
  image_1: varchar(),
  image_2: varchar(),
  location: varchar(),
  city: varchar(),
  county: varchar(),
  code: varchar(),
  description: varchar(),
});
export type Park = typeof park.$inferSelect;
export type InsertPark = typeof park.$inferInsert;

export const cottages = pgTable('cottages_table', {
  id: uuid().defaultRandom().primaryKey(),
  cottage_name: varchar(),
  location: varchar(),
  cottage_code: varchar(),
  bedrooms: integer(),
  bathrooms: integer(),
  sleeps: integer(),
  pets: integer(),
  image_1: varchar(),
  image_2: varchar(),
  details_url: varchar(),
});
export type Cottage = typeof cottages.$inferSelect;
export type InsertCottage = typeof cottages.$inferInsert;

export const lodges = pgTable(
  'lodges_table',
  {
    id: uuid().defaultRandom().primaryKey(),
    park_id: uuid().references(() => park.id),
    lodge_name: varchar(),
    lodge_code: varchar(),
    image: varchar(),
    adults: integer(),
    children: integer(),
    bedrooms: integer(),
    bathrooms: integer(),
    pets: integer(),
    sleeps: integer(),
    infants: integer(),
  },
  (table) => ({
    emailIdx: index('lodge_code_idx').on(table.lodge_code),
  })
);
export type Lodge = typeof lodges.$inferSelect;
export type InsertLodge = typeof lodges.$inferInsert;

export const cruise_extra_item = pgTable('cruise_extra_item_table', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar(),
});
export type CruiseExtraItem = typeof cruise_extra_item.$inferSelect;
export type InsertCruiseExtraItem = typeof cruise_extra_item.$inferInsert;

export const deletion_codes = pgTable('deletion_codes', {
  id: uuid().defaultRandom().primaryKey(),
  is_used: boolean().default(false),
  code: varchar(),
  created_at: timestamp({ mode: 'string' }).notNull().defaultNow(),
});
export type DeletionCode = typeof deletion_codes.$inferSelect;
export type InsertDeletionCode = typeof deletion_codes.$inferInsert;

export const room_type = pgTable('room_type', {
  id: uuid().defaultRandom().primaryKey(),
  name: varchar(),
});
export type RoomType = typeof room_type.$inferSelect;
export type InsertRoomType = typeof room_type.$inferInsert;

export const deal_images = pgTable('deal_images', {
  id: uuid().defaultRandom().primaryKey(),
  image_url: varchar(),
  s3Key: varchar(),
  owner_type: owner_type_enum(),
  owner_id: text().notNull(),
  isPrimary: boolean().default(false),
}, (table) => ({
  unique_key: unique().on(table.owner_id, table.image_url)
}));
export type DealImage = typeof deal_images.$inferSelect;
export type InsertDealImage = typeof deal_images.$inferInsert;

export const forwardsReport = pgTable('forwards_report', {
  id: uuid().defaultRandom().primaryKey(),
  month: integer().notNull(),
  monthName: varchar().notNull(),
  year: integer().notNull(),
  target: numeric({ precision: 10, scale: 2 }).notNull(),
  company_commission: numeric({ precision: 10, scale: 2 }).notNull(),
  agent_commission: numeric({ precision: 10, scale: 2 }).notNull(),
  created_at: timestamp({ mode: 'string' }).notNull().defaultNow(),
  adjustment: numeric({ precision: 10, scale: 2 }).default("0.00"),
  deal_ids: text().array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  historical_ids: text().array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
}, (table) => ({
  unique_year_month: unique().on(table.year, table.month),
  year_month_idx: index('forwards_report_year_month_idx').on(table.year, table.month),
}));
export type ForwardsReport = typeof forwardsReport.$inferSelect;
export type InsertForwardsReport = typeof forwardsReport.$inferInsert;

export const airport = pgTable('airport_table', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  airport_code: varchar().notNull(),
  airport_name: varchar().notNull(),
  country_id: uuid().references(() => country.id),
});
export const insertAirportSchema = createInsertSchema(airport).omit({ id: true });
export type Airport = typeof airport.$inferSelect;
export type InsertAirport = typeof airport.$inferInsert;

export const flights = pgTable('flights_table', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  flight_id: varchar(),
  flight_number: varchar(),
  flight_route: varchar(),
  departure_date: date({ mode: 'string' }),
  departure_time: varchar(),
  arrival_date: date({ mode: 'string' }),
  arrival_time: varchar(),
  departure_airport_id: uuid().references(() => airport.id),
  destination_airport_id: uuid().references(() => airport.id),
});
export type FlightRecord = typeof flights.$inferSelect;
export type InsertFlightRecord = typeof flights.$inferInsert;

export const airport_relations = relations(airport, ({ one, many }) => ({
  enquiry_departure_airport: many(enquiry_departure_airport),
  departure_flight: many(flights, { relationName: 'departure_airport_relation' }),
  destination_flight: many(flights, { relationName: 'destination_airport_relation' }),
  country: one(country, {
    fields: [airport.country_id],
    references: [country.id],
  }),
  quote_lounge_pass: many(quote_lounge_pass),
  quote_parking: many(quote_airport_parking),
  quote_flights_departure_airport: many(quote_flights, { relationName: 'departing_airport_relation' }),
  quote_flights_arrival_airport: many(quote_flights, { relationName: 'arrival_airport_relation' }),
  booking_lounge_pass: many(booking_lounge_pass),
  booking_parking: many(booking_airport_parking),
  booking_flights_departure_airport: many(booking_flights, { relationName: 'departing_airport_relation' }),
  booking_flights_arrival_airport: many(booking_flights, { relationName: 'arrival_airport_relation' }),
}));

export const flight_relations = relations(flights, ({ one }) => ({
  departure_aiport: one(airport, {
    fields: [flights.departure_airport_id],
    references: [airport.id],
    relationName: 'departure_airport_relation',
  }),
  destination_aiport: one(airport, {
    fields: [flights.destination_airport_id],
    references: [airport.id],
    relationName: 'destination_airport_relation',
  }),
}));

export const cruise_line = pgTable('cruise_line_table', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  name: varchar(),
});
export type CruiseLine = typeof cruise_line.$inferSelect;
export type InsertCruiseLine = typeof cruise_line.$inferInsert;

export const cruise_ship = pgTable('ship_table', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  name: varchar(),
  cruise_line_id: uuid().references(() => cruise_line.id, { onDelete: "cascade" }),
});
export type CruiseShip = typeof cruise_ship.$inferSelect;
export type InsertCruiseShip = typeof cruise_ship.$inferInsert;

export const cruise_itenary = pgTable('cruise_itenary_table', {
  id: uuid().defaultRandom().primaryKey(),
  ship_id: uuid().references(() => cruise_ship.id, { onDelete: "cascade" }),
  itenary: varchar(),
  departure_port: varchar().notNull(),
  date: date().notNull(),
});
export type CruiseItenary = typeof cruise_itenary.$inferSelect;
export type InsertCruiseItenary = typeof cruise_itenary.$inferInsert;

export const cruise_voyage = pgTable('cruise_voyage_table', {
  id: uuid().defaultRandom().primaryKey(),
  itinerary_id: uuid().references(() => cruise_itenary.id, { onDelete: "cascade" }),
  day_number: numeric(),
  description: varchar(),
});
export type CruiseVoyage = typeof cruise_voyage.$inferSelect;
export type InsertCruiseVoyage = typeof cruise_voyage.$inferInsert;

export const cruise_destination = pgTable('cruise_destination_table', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  name: varchar(),
});
export type CruiseDestination = typeof cruise_destination.$inferSelect;
export type InsertCruiseDestination = typeof cruise_destination.$inferInsert;

export const port = pgTable('port_table', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  cruise_destination_id: uuid().references(() => cruise_destination.id),
  name: varchar(),
});
export type Port = typeof port.$inferSelect;
export type InsertPort = typeof port.$inferInsert;

export const cruise_line_relation = relations(cruise_line, ({ many }) => ({
  cruise_ship: many(cruise_ship),
  enquiry_cruise_line: many(enquiry_cruise_line),
}));

export const cruise_ship_relation = relations(cruise_ship, ({ one, many }) => ({
  cruise_line: one(cruise_line, {
    fields: [cruise_ship.cruise_line_id],
    references: [cruise_line.id],
  }),
  itenary: many(cruise_itenary),
}));

export const cruise_itenerary_relation = relations(cruise_itenary, ({ one, many }) => ({
  cruise_ship: one(cruise_ship, {
    fields: [cruise_itenary.ship_id],
    references: [cruise_ship.id],
  }),
  cruise_voyage: many(cruise_voyage),
}));

export const cruise_voyage_relation = relations(cruise_voyage, ({ one }) => ({
  cruise_itenary: one(cruise_itenary, {
    fields: [cruise_voyage.itinerary_id],
    references: [cruise_itenary.id],
  }),
}));

export const cruise_destination_relation = relations(cruise_destination, ({ many }) => ({
  port: many(port),
  enquiry_cruise_destination: many(enquiry_cruise_destination),
}));

export const port_relation = relations(port, ({ one }) => ({
  cruise_destination: one(cruise_destination, {
    fields: [port.cruise_destination_id],
    references: [cruise_destination.id],
  }),
}));

export const transaction = pgTable('transaction', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  status: transaction_status_enum(),
  is_active: boolean().default(true),
  client_id: uuid().references(() => clientTable.id),
  agent_id: text().references(() => user.id),
  lead_source: lead_source_enum().default('SHOP'),
  user_id: text().notNull().references(() => user.id),
  created_at: timestamp().notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transaction).omit({ id: true, created_at: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transaction.$inferSelect;

export const enquiry_table = pgTable('enquiry_table', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  transaction_id: uuid().notNull().references(() => transaction.id, { onDelete: "cascade" }).unique(),
  holiday_type_id: uuid().notNull().references(() => package_type.id),
  accomodation_type_id: uuid().references(() => accomodation_type.id),
  travel_date: date({ mode: "string" }),
  adults: integer(),
  children: integer(),
  infants: integer(),
  cabin_type: varchar(),
  title: varchar(),
  flexibility_date: varchar(),
  flexible_date: varchar(),
  weekend_lodge: varchar(),
  accom_min_star_rating: varchar(),
  no_of_nights: integer(),
  budget: numeric(),
  max_budget: numeric().default('0.00'),
  budget_type: budget_type_enum().default('PACKAGE'),
  no_of_guests: integer(),
  no_of_pets: integer(),
  pre_cruise_stay: integer(),
  post_cruise_stay: integer(),
  status: enquiry_status_enum().default('NEW_LEAD'),
  date_created: timestamp({ withTimezone: true }).defaultNow(),
  date_expiry: timestamp({ withTimezone: true }),
  is_future_deal: boolean().default(false),
  future_deal_date: date({ mode: "string" }),
  is_expired: boolean().default(false),
  is_active: boolean().default(true),
  deletion_code: varchar(),
  deleted_by: text().references(() => user.id),
  deleted_at: timestamp({ withTimezone: true }),
  email: varchar(),
});

export const insertEnquiryTableSchema = createInsertSchema(enquiry_table).omit({ id: true, date_created: true });
export type InsertEnquiryTable = z.infer<typeof insertEnquiryTableSchema>;
export type EnquiryTable = typeof enquiry_table.$inferSelect;

export const enquiry_destination = pgTable('enquiry_destination', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  destination_id: uuid().references(() => destination.id),
});
export type EnquiryDestination = typeof enquiry_destination.$inferSelect;
export type InsertEnquiryDestination = typeof enquiry_destination.$inferInsert;

export const enquiry_resorts = pgTable('enquiry_resorts', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  resorts_id: uuid().references(() => resorts.id),
});
export type EnquiryResorts = typeof enquiry_resorts.$inferSelect;
export type InsertEnquiryResorts = typeof enquiry_resorts.$inferInsert;

export const enquiry_accomodation = pgTable('enquiry_accomodation', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  accomodation_id: uuid().references(() => accomodation_list.id),
});
export type EnquiryAccomodation = typeof enquiry_accomodation.$inferSelect;
export type InsertEnquiryAccomodation = typeof enquiry_accomodation.$inferInsert;

export const enquiry_board_basis = pgTable('enquiry_board_basis', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  board_basis_id: uuid().references(() => board_basis.id),
});
export type EnquiryBoardBasis = typeof enquiry_board_basis.$inferSelect;
export type InsertEnquiryBoardBasis = typeof enquiry_board_basis.$inferInsert;

export const enquiry_departure_airport = pgTable('enquiry_departure_airport', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  airport_id: uuid().references(() => airport.id),
});
export type EnquiryDepartureAirport = typeof enquiry_departure_airport.$inferSelect;
export type InsertEnquiryDepartureAirport = typeof enquiry_departure_airport.$inferInsert;

export const enquiry_departure_port = pgTable('enquiry_departure_port', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  port_id: uuid().references(() => port.id),
});
export type EnquiryDeparturePort = typeof enquiry_departure_port.$inferSelect;
export type InsertEnquiryDeparturePort = typeof enquiry_departure_port.$inferInsert;

export const enquiry_cruise_line = pgTable('enquiry_cruise_line', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  cruise_line_id: uuid().references(() => cruise_line.id),
});
export type EnquiryCruiseLine = typeof enquiry_cruise_line.$inferSelect;
export type InsertEnquiryCruiseLine = typeof enquiry_cruise_line.$inferInsert;

export const enquiry_cruise_destination = pgTable('enquiry_cruise_destination', {
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  cruise_destination_id: uuid().references(() => cruise_destination.id),
});
export type EnquiryCruiseDestination = typeof enquiry_cruise_destination.$inferSelect;
export type InsertEnquiryCruiseDestination = typeof enquiry_cruise_destination.$inferInsert;

export const enquiry_passenger = pgTable('enquiry_passenger', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  enquiry_id: uuid().references(() => enquiry_table.id, { onDelete: "cascade" }),
  type: varchar(),
  age: integer(),
});
export type EnquiryPassenger = typeof enquiry_passenger.$inferSelect;
export type InsertEnquiryPassenger = typeof enquiry_passenger.$inferInsert;

export const quote = pgTable('quote_table', {
  id: uuid().defaultRandom().primaryKey(),
  transaction_id: uuid().references(() => transaction.id, { onDelete: 'cascade' }).notNull(),
  deal_id: varchar(),
  holiday_type_id: uuid().references(() => package_type.id).notNull(),
  sales_price: numeric('sales_price', { precision: 10, scale: 2 }),
  package_commission: numeric('package_commission', { precision: 10, scale: 2 }),
  travel_date: date().notNull(),
  discounts: numeric('discounts', { precision: 10, scale: 2 }),
  service_charge: numeric('service_charge', { precision: 10, scale: 2 }),
  num_of_nights: integer().default(0).notNull(),
  is_expired: boolean().default(false),
  pets: integer().default(0).notNull(),
  cottage_id: uuid().references(() => cottages.id),
  lodge_id: uuid().references(() => lodges.id),
  quote_type: varchar().notNull(),
  deal_type: varchar(),
  pre_booked_seats: varchar(),
  flight_meals: boolean().default(false),
  infant: integer(),
  child: integer(),
  adult: integer(),
  title: varchar(),
  price_per_person: numeric('price_per_person', { precision: 10, scale: 2 }).default("0.00").notNull(),
  lodge_type: varchar(),
  transfer_type: varchar('transfer_type').default('none').notNull(),
  quote_status: quote_status_enum(),
  main_tour_operator_id: uuid().references(() => tour_operator.id),
  date_created: timestamp({ precision: 0, withTimezone: true }).defaultNow(),
  date_expiry: timestamp({ precision: 0, withTimezone: true }),
  is_future_deal: boolean().default(false),
  future_deal_date: date({ mode: 'string' }),
  is_active: boolean().default(true),
  deletion_code: varchar(),
  deleted_by: uuid(),
  deleted_by_v2: text().references(() => user.id),
  deleted_at: timestamp({ precision: 0, withTimezone: true }),
  quote_ref: varchar(),
  isQuoteCopy: boolean().default(false),
  isFreeQuote: boolean().default(false),
});

export const insertQuoteSchema = createInsertSchema(quote).omit({ id: true, date_created: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quote.$inferSelect;

export const quote_flights = pgTable('quote_flights', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
  flight_number: varchar(),
  flight_ref: varchar(),
  departing_airport_id: uuid().references(() => airport.id),
  arrival_airport_id: uuid().references(() => airport.id),
  tour_operator_id: uuid().references(() => tour_operator.id),
  flight_type: varchar(),
  leg_order: integer().default(0).notNull(),
  departure_date_time: timestamp(),
  arrival_date_time: timestamp(),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
});
export type QuoteFlight = typeof quote_flights.$inferSelect;
export type InsertQuoteFlight = typeof quote_flights.$inferInsert;

export const quote_accomodation = pgTable('quote_accomodation', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  no_of_nights: integer().notNull().default(0),
  room_type: varchar(),
  board_basis_id: uuid().references(() => board_basis.id),
  check_in_date_time: timestamp({ precision: 6, withTimezone: true }),
  stay_type: varchar(),
  is_primary: boolean().default(false),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  accomodation_id: uuid().references(() => accomodation_list.id),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
});
export type QuoteAccomodation = typeof quote_accomodation.$inferSelect;
export type InsertQuoteAccomodation = typeof quote_accomodation.$inferInsert;

export const quote_transfers = pgTable('quote_transfers', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  pick_up_location: varchar(),
  drop_off_location: varchar(),
  pick_up_time: timestamp(),
  drop_off_time: timestamp(),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
  note: varchar(),
});
export type QuoteTransfer = typeof quote_transfers.$inferSelect;
export type InsertQuoteTransfer = typeof quote_transfers.$inferInsert;

export const quote_car_hire = pgTable('quote_car_hire', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  pick_up_location: varchar(),
  drop_off_location: varchar(),
  pick_up_time: timestamp(),
  drop_off_time: timestamp(),
  no_of_days: integer().notNull().default(0),
  driver_age: integer().notNull().default(0),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
});
export type QuoteCarHire = typeof quote_car_hire.$inferSelect;
export type InsertQuoteCarHire = typeof quote_car_hire.$inferInsert;

export const quote_attraction_ticket = pgTable('quote_attraction_ticket', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  ticket_type: varchar(),
  date_of_visit: timestamp(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  number_of_tickets: integer().notNull().default(0),
  is_included_in_package: boolean(),
});
export type QuoteAttractionTicket = typeof quote_attraction_ticket.$inferSelect;
export type InsertQuoteAttractionTicket = typeof quote_attraction_ticket.$inferInsert;

export const quote_lounge_pass = pgTable('quote_lounge_pass', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
  booking_ref: varchar(),
  terminal: varchar(),
  airport_id: uuid().references(() => airport.id),
  date_of_usage: timestamp(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  is_included_in_package: boolean(),
  note: varchar(),
});
export type QuoteLoungePass = typeof quote_lounge_pass.$inferSelect;
export type InsertQuoteLoungePass = typeof quote_lounge_pass.$inferInsert;

export const quote_airport_parking = pgTable('quote_airport_parking', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_ref: varchar(),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
  airport_id: uuid().references(() => airport.id),
  parking_type: varchar(),
  parking_date: timestamp(),
  car_make: varchar(),
  car_model: varchar(),
  colour: varchar(),
  car_reg_number: varchar(),
  duration: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
});
export type QuoteAirportParking = typeof quote_airport_parking.$inferSelect;
export type InsertQuoteAirportParking = typeof quote_airport_parking.$inferInsert;

export const quote_cruise = pgTable('quote_cruise', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  cruise_line: varchar(),
  ship: varchar(),
  cruise_date: date(),
  cabin_type: varchar(),
  cruise_name: varchar(),
  pre_cruise_stay: integer().notNull(),
  post_cruise_stay: integer().notNull(),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
});
export type QuoteCruise = typeof quote_cruise.$inferSelect;
export type InsertQuoteCruise = typeof quote_cruise.$inferInsert;

export const quote_cruise_item_extra = pgTable('quote_cruise_item_extra', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  cruise_extra_id: uuid().references(() => cruise_extra_item.id),
  quote_cruise_id: uuid().references(() => quote_cruise.id, { onDelete: "cascade" }),
});
export type QuoteCruiseItemExtra = typeof quote_cruise_item_extra.$inferSelect;
export type InsertQuoteCruiseItemExtra = typeof quote_cruise_item_extra.$inferInsert;

export const quote_cruise_itinerary = pgTable('quote_cruise_itinerary', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quote_cruise_id: uuid().references(() => quote_cruise.id, { onDelete: "cascade" }),
  day_number: integer(),
  description: varchar(),
});
export type QuoteCruiseItinerary = typeof quote_cruise_itinerary.$inferSelect;
export type InsertQuoteCruiseItinerary = typeof quote_cruise_itinerary.$inferInsert;

export const booking = pgTable('booking_table', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  transaction_id: uuid().notNull().references(() => transaction.id, { onDelete: "cascade" }).unique(),
  deal_type: varchar(),
  pre_booked_seats: varchar(),
  flight_meals: boolean().default(false),
  holiday_type_id: uuid().notNull().references(() => package_type.id),
  hays_ref: varchar().notNull(),
  supplier_ref: varchar().notNull(),
  is_active: boolean().default(true),
  sales_price: numeric({ precision: 10, scale: 2 }),
  package_commission: numeric({ precision: 10, scale: 2 }),
  travel_date: date().notNull(),
  title: varchar(),
  discounts: numeric({ precision: 10, scale: 2 }),
  service_charge: numeric({ precision: 10, scale: 2 }),
  num_of_nights: integer().notNull().default(0),
  pets: integer().notNull().default(0),
  cottage_id: uuid().references(() => cottages.id),
  lodge_id: uuid().references(() => lodges.id),
  lodge_type: varchar(),
  transfer_type: varchar(),
  infant: integer().notNull().default(0),
  child: integer().notNull().default(0),
  adult: integer().notNull().default(0),
  booking_status: booking_status_enum(),
  main_tour_operator_id: uuid().references(() => tour_operator.id),
  date_created: timestamp({ withTimezone: true }).defaultNow(),
  deletion_code: varchar(),
  deleted_by: uuid("deleted_by"),
  deleted_by_user: text("deleted_by_user").references(() => user.id),
  deleted_at: timestamp({ precision: 0, withTimezone: true }).defaultNow(),
});

export const insertBookingSchema = createInsertSchema(booking).omit({ id: true, date_created: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof booking.$inferSelect;

export const passengers = pgTable('passengers', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  type: varchar(),
  age: integer().notNull().default(0),
  quote_id: uuid().references(() => quote.id, { onDelete: "cascade" }),
  lounge_pass_id: uuid().references(() => quote_lounge_pass.id, { onDelete: "cascade" }),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
});
export type Passenger = typeof passengers.$inferSelect;
export type InsertPassenger = typeof passengers.$inferInsert;

export const travel_deal = pgTable('travel_deal', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  title: varchar().notNull(),
  subtitle: varchar(),
  post: text().notNull(),
  resortSummary: varchar(),
  hashtags: text().array().notNull().default(sql`ARRAY[]::text[]`),
  travelDate: date({ mode: "string" }),
  nights: integer().notNull(),
  boardBasis: varchar(),
  departureAirport: varchar(),
  postSchedule: timestamp({ withTimezone: true }),
  onlySocialsId: varchar(),
  luggageTransfers: varchar(),
  price: numeric({ precision: 10, scale: 2 }),
  quote_id: uuid().notNull().references(() => quote.id, { onDelete: "cascade" }),
  created_at: timestamp({ withTimezone: true }).defaultNow(),
});
export type TravelDeal = typeof travel_deal.$inferSelect;
export type InsertTravelDeal = typeof travel_deal.$inferInsert;

export const booking_flights = pgTable('booking_flights', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
  flight_number: varchar(),
  flight_ref: varchar(),
  departing_airport_id: uuid().references(() => airport.id),
  arrival_airport_id: uuid().references(() => airport.id),
  tour_operator_id: uuid().references(() => tour_operator.id),
  flight_type: varchar(),
  departure_date_time: timestamp(),
  arrival_date_time: timestamp(),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
});
export type BookingFlight = typeof booking_flights.$inferSelect;
export type InsertBookingFlight = typeof booking_flights.$inferInsert;

export const booking_accomodation = pgTable('booking_accomodation', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  no_of_nights: integer().notNull().default(0),
  room_type: varchar(),
  board_basis_id: uuid().references(() => board_basis.id),
  check_in_date_time: timestamp(),
  stay_type: varchar(),
  is_primary: boolean().default(false),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  accomodation_id: uuid().references(() => accomodation_list.id),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
});
export type BookingAccomodation = typeof booking_accomodation.$inferSelect;
export type InsertBookingAccomodation = typeof booking_accomodation.$inferInsert;

export const booking_transfers = pgTable('booking_transfers', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  pick_up_location: varchar(),
  drop_off_location: varchar(),
  pick_up_time: timestamp(),
  drop_off_time: timestamp(),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
  note: varchar(),
});
export type BookingTransfer = typeof booking_transfers.$inferSelect;
export type InsertBookingTransfer = typeof booking_transfers.$inferInsert;

export const booking_car_hire = pgTable('booking_car_hire', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  pick_up_location: varchar(),
  drop_off_location: varchar(),
  pick_up_time: timestamp(),
  drop_off_time: timestamp(),
  no_of_days: integer(),
  driver_age: integer(),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
});
export type BookingCarHire = typeof booking_car_hire.$inferSelect;
export type InsertBookingCarHire = typeof booking_car_hire.$inferInsert;

export const booking_attraction_ticket = pgTable('booking_attraction_ticket', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
  booking_ref: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  ticket_type: varchar(),
  date_of_visit: timestamp(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  number_of_tickets: integer(),
  is_included_in_package: boolean(),
});
export type BookingAttractionTicket = typeof booking_attraction_ticket.$inferSelect;
export type InsertBookingAttractionTicket = typeof booking_attraction_ticket.$inferInsert;

export const booking_lounge_pass = pgTable('booking_lounge_pass', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
  booking_ref: varchar(),
  terminal: varchar(),
  airport_id: uuid().references(() => airport.id),
  date_of_usage: timestamp(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
  is_included_in_package: boolean(),
  note: varchar(),
});
export type BookingLoungePass = typeof booking_lounge_pass.$inferSelect;
export type InsertBookingLoungePass = typeof booking_lounge_pass.$inferInsert;

export const booking_airport_parking = pgTable('booking_airport_parking', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_ref: varchar(),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
  airport_id: uuid().references(() => airport.id),
  parking_type: varchar(),
  parking_date: timestamp(),
  car_make: varchar(),
  car_model: varchar(),
  colour: varchar(),
  car_reg_number: varchar(),
  duration: varchar(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  is_included_in_package: boolean(),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }),
});
export type BookingAirportParking = typeof booking_airport_parking.$inferSelect;
export type InsertBookingAirportParking = typeof booking_airport_parking.$inferInsert;

export const booking_cruise = pgTable('booking_cruise', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_id: uuid().references(() => booking.id, { onDelete: "cascade" }),
  tour_operator_id: uuid().references(() => tour_operator.id),
  cruise_line: varchar(),
  ship: varchar(),
  cruise_date: date(),
  cabin_type: varchar(),
  cruise_name: varchar(),
  pre_cruise_stay: integer(),
  post_cruise_stay: integer(),
});
export type BookingCruise = typeof booking_cruise.$inferSelect;
export type InsertBookingCruise = typeof booking_cruise.$inferInsert;

export const booking_cruise_item_extra = pgTable('booking_cruise_item_extra', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  cruise_extra_id: uuid().references(() => cruise_extra_item.id),
  booking_cruise_id: uuid().references(() => booking_cruise.id, { onDelete: "cascade" }),
});
export type BookingCruiseItemExtra = typeof booking_cruise_item_extra.$inferSelect;
export type InsertBookingCruiseItemExtra = typeof booking_cruise_item_extra.$inferInsert;

export const booking_cruise_itinerary = pgTable('booking_cruise_itinerary', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_cruise_id: uuid().references(() => booking_cruise.id, { onDelete: "cascade" }),
  day_number: integer(),
  description: varchar(),
});
export type BookingCruiseItinerary = typeof booking_cruise_itinerary.$inferSelect;
export type InsertBookingCruiseItinerary = typeof booking_cruise_itinerary.$inferInsert;

export const notes = pgTable('notes', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  description: varchar(),
  content: text(),
  agent_id: text().references(() => user.id),
  user_id: text().references(() => user.id),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  parent_id: varchar(),
  transaction_id: uuid().references(() => transaction.id, { onDelete: "cascade" }),
});

export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

export const task = pgTable('task', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  agent_id: text().references(() => user.id, { onDelete: "set null" }),
  user_id: text().references(() => user.id, { onDelete: "set null" }),
  client_id: uuid().references(() => clientTable.id, { onDelete: "set null" }),
  assigned_by_id: text().references(() => user.id, { onDelete: "set null" }),
  transaction_id: uuid().references(() => transaction.id, { onDelete: "cascade" }),
  deal_id: varchar(),
  transaction_type: varchar(),
  title: varchar(),
  type: varchar().default('task'),
  task: varchar(),
  due_date: timestamp(),
  number: varchar(),
  priority: varchar(),
  status: varchar(),
  created_at: timestamp({ mode: 'string' }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(task).omit({ id: true, created_at: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof task.$inferSelect;

export const referral = pgTable('referral', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  referrerId: text("referrerId").references(() => user.id, { onDelete: "set null" }),
  transactionId: uuid("transactionId").references(() => transaction.id, { onDelete: "cascade" }),
  referralStatus: referral_status_enum("referralStatus").default('PENDING'),
  potentialCommission: numeric("potentialCommission"),
  commission: numeric("commission"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referral).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referral.$inferSelect;

export const referral_request = pgTable('referral_request', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  referrerId: text("referrerId").references(() => user.id, { onDelete: "cascade" }),
  referredStatus: referral_request_status_enum("referredStatus").default('PENDING'),
  notes: varchar("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  clientId: uuid("clientId").references(() => clientTable.id, { onDelete: "cascade" }),
});

export const insertReferralRequestSchema = createInsertSchema(referral_request).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferralRequest = z.infer<typeof insertReferralRequestSchema>;
export type ReferralRequest = typeof referral_request.$inferSelect;

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  type: text("type").notNull(),
  status: text("status").notNull().default("Open"),
  priority: text("priority").notNull().default("Medium"),
  subject: text("subject").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export const ticketAttachments = pgTable("ticket_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTicketAttachmentSchema = createInsertSchema(ticketAttachments).omit({ id: true, createdAt: true });
export type InsertTicketAttachment = z.infer<typeof insertTicketAttachmentSchema>;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;

export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  parentReplyId: varchar("parent_reply_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTicketReplySchema = createInsertSchema(ticketReplies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;
export type TicketReply = typeof ticketReplies.$inferSelect;

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(),
  itemId: varchar("item_id").notNull(),
  label: text("label").notNull(),
  subtitle: text("subtitle"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

// ============================================================
// LEGACY TABLE DEFINITIONS (backward compatibility)
// These map to old tables still in the database.
// New code should use the transaction-centric tables above.
// ============================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  role: text("role"),
  avatar: text("avatar"),
  first_name: varchar("first_name"),
  last_name: varchar("last_name"),
  profile_image_url: varchar("profile_image_url"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey(),
  clientType: text("client_type"),
  title: text("title"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  tier: text("tier"),
  stage: text("stage"),
  location: text("location"),
  houseNumber: text("house_number"),
  street: text("street"),
  city: text("city"),
  country: text("country"),
  postcode: text("postcode"),
  nextTrip: text("next_trip"),
  value: numeric("value"),
  lastTouch: text("last_touch"),
  tags: text("tags").array(),
  userId: varchar("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients);
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey(),
  clientId: uuid("client_id"),
  userId: varchar("user_id"),
  status: text("status"),
  packageType: text("package_type"),
  quoteTitle: text("quote_title"),
  destination: text("destination"),
  travelDate: text("travel_date"),
  returnDate: text("return_date"),
  passengersAdults: integer("passengers_adults"),
  passengersChildren: integer("passengers_children"),
  childAges: text("child_ages").array(),
  createdAt: timestamp("created_at").defaultNow(),
  quoteLink: text("quote_link"),
  country: text("country"),
  resort: text("resort"),
  passengersInfants: integer("passengers_infants"),
  checkInDate: text("check_in_date"),
  checkInTime: text("check_in_time"),
  nights: integer("nights"),
  transferType: text("transfer_type"),
  preBookedSeats: text("pre_booked_seats"),
  flightMeals: text("flight_meals"),
  leadSource: text("lead_source"),
  haysReference: text("hays_reference"),
  tourReference: text("tour_reference"),
  bookedAt: timestamp("booked_at"),
  tags: text("tags").array(),
});

export const accommodations = pgTable("accommodations", {
  id: varchar("id").primaryKey(),
  quoteId: varchar("quote_id"),
  property: text("property"),
  board: text("board"),
  roomType: text("room_type"),
  notes: text("notes"),
});

export const insertAccommodationSchema = createInsertSchema(accommodations);
export type Accommodation = typeof accommodations.$inferSelect;
export type InsertAccommodation = z.infer<typeof insertAccommodationSchema>;


export const commissions = pgTable("commissions", {
  id: varchar("id").primaryKey(),
  quoteId: varchar("quote_id"),
  tourOperator: text("tour_operator"),
  price: numeric("price"),
  commissionPercent: numeric("commission_percent"),
  commissionValue: numeric("commission_value"),
  agentSplitPercent: numeric("agent_split_percent"),
  agentSplitValue: numeric("agent_split_value"),
  netToAgency: numeric("net_to_agency"),
});

export const insertCommissionSchema = createInsertSchema(commissions);
export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;

export const quoteImages = pgTable("quote_images", {
  id: varchar("id").primaryKey(),
  quoteId: uuid("quote_id").references(() => quote.id, { onDelete: 'cascade' }),
  url: text("url"),
  isPrimary: boolean("is_primary"),
});

export const insertQuoteImageSchema = createInsertSchema(quoteImages);
export type QuoteImage = typeof quoteImages.$inferSelect;
export type InsertQuoteImage = z.infer<typeof insertQuoteImageSchema>;


export const tourOperators = pgTable("tour_operators", {
  id: varchar("id").primaryKey(),
  name: text("name"),
  holidayType: text("holiday_type"),
  commissionPercent: numeric("commission_percent"),
  username: text("username"),
  password: text("password"),
  contact: text("contact"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTourOperatorSchema = createInsertSchema(tourOperators);
export type TourOperator = typeof tourOperators.$inferSelect;
export type InsertTourOperator = z.infer<typeof insertTourOperatorSchema>;

export const enquiries = pgTable("enquiries", {
  id: varchar("id").primaryKey(),
  clientId: varchar("client_id"),
  userId: varchar("user_id"),
  enquiryTitle: text("enquiry_title"),
  holidayType: text("holiday_type"),
  country: text("country"),
  destination: text("destination"),
  resort: text("resort"),
  departureAirport: text("departure_airport"),
  travelDate: text("travel_date"),
  flexibility: text("flexibility"),
  passengersAdults: integer("passengers_adults"),
  passengersChildren: integer("passengers_children"),
  passengersInfants: integer("passengers_infants"),
  nights: integer("nights"),
  starRating: text("star_rating"),
  boardBasis: text("board_basis"),
  budget: numeric("budget"),
  budgetType: text("budget_type"),
  status: text("status"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  notes: text("notes"),
});

export const insertEnquirySchema = createInsertSchema(enquiries);
export type Enquiry = typeof enquiries.$inferSelect;
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;

export const enquiryNotes = pgTable("enquiry_notes", {
  id: varchar("id").primaryKey(),
  enquiryId: varchar("enquiry_id"),
  parentId: varchar("parent_id"),
  content: text("content"),
  authorName: text("author_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEnquiryNoteSchema = createInsertSchema(enquiryNotes);
export type EnquiryNote = typeof enquiryNotes.$inferSelect;
export type InsertEnquiryNote = z.infer<typeof insertEnquiryNoteSchema>;

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey(),
  entityType: text("entity_type"),
  entityId: varchar("entity_id"),
  userId: varchar("user_id"),
  title: text("title"),
  dueDate: timestamp("due_date"),
  completed: boolean("completed"),
  completedAt: timestamp("completed_at"),
  notified: boolean("notified"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTasksSchema = createInsertSchema(tasks);
