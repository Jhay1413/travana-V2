import { sql } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, integer, decimal, numeric, timestamp, boolean, index, jsonb, uuid, date, unique, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Users table with Replit Auth fields
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("Agent"), // Admin, Manager, Agent, Homeworker, Referer
  avatar: text("avatar"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientType: text("client_type").notNull().default("New Client"), // Time Waster, New Client, Repeat Client, VIP Client, Family Member, Banned
  title: text("title"), // Mr., Mrs, Ms, Miss
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  tier: text("tier").notNull().default("Standard"), // Platinum, Gold, Standard
  stage: text("stage").notNull().default("Enquiry"), // Enquiry, Quote, Booked
  location: text("location"),
  houseNumber: text("house_number"),
  street: text("street"),
  city: text("city"),
  country: text("country"),
  postcode: text("postcode"),
  nextTrip: text("next_trip"),
  value: decimal("value", { precision: 10, scale: 2 }).notNull().default("0"),
  lastTouch: text("last_touch"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Quotes table
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id), // owner
  status: text("status").notNull().default("In Play"), // In Play, Won, Lost
  packageType: text("package_type").notNull(),
  quoteTitle: text("quote_title").notNull(),
  quoteLink: text("quote_link"),
  destination: text("destination").notNull(),
  country: text("country"),
  resort: text("resort"),
  travelDate: text("travel_date").notNull(),
  returnDate: text("return_date").notNull(),
  passengersAdults: integer("passengers_adults").notNull().default(2),
  passengersChildren: integer("passengers_children").notNull().default(0),
  passengersInfants: integer("passengers_infants").notNull().default(0),
  childAges: integer("child_ages").array().notNull().default(sql`'{}'::integer[]`),
  checkInDate: text("check_in_date"),
  checkInTime: text("check_in_time"),
  nights: integer("nights"),
  transferType: text("transfer_type"),
  preBookedSeats: text("pre_booked_seats"),
  flightMeals: text("flight_meals"),
  leadSource: text("lead_source"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// Accommodations table
export const accommodations = pgTable("accommodations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  property: text("property").notNull(),
  board: text("board").notNull(),
  roomType: text("room_type").notNull(),
  notes: text("notes"),
});

export const insertAccommodationSchema = createInsertSchema(accommodations).omit({ id: true });
export type InsertAccommodation = z.infer<typeof insertAccommodationSchema>;
export type Accommodation = typeof accommodations.$inferSelect;

// Flights table
export const flights = pgTable("flights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // outbound, inbound
  fromAirport: text("from_airport").notNull(),
  toAirport: text("to_airport").notNull(),
  carrier: text("carrier").notNull(),
  flightNo: text("flight_no").notNull(),
  depart: timestamp("depart").notNull(),
  arrive: timestamp("arrive").notNull(),
});

export const insertFlightSchema = createInsertSchema(flights).omit({ id: true });
export type InsertFlight = z.infer<typeof insertFlightSchema>;
export type Flight = typeof flights.$inferSelect;

// Commissions table
export const commissions = pgTable("commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }).unique(),
  tourOperator: text("tour_operator").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }).notNull(),
  commissionValue: decimal("commission_value", { precision: 10, scale: 2 }).notNull(),
  agentSplitPercent: decimal("agent_split_percent", { precision: 5, scale: 2 }).notNull(),
  agentSplitValue: decimal("agent_split_value", { precision: 10, scale: 2 }).notNull(),
  netToAgency: decimal("net_to_agency", { precision: 10, scale: 2 }).notNull(),
});

export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

// Quote Images table
export const quoteImages = pgTable("quote_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const insertQuoteImageSchema = createInsertSchema(quoteImages).omit({ id: true });
export type InsertQuoteImage = z.infer<typeof insertQuoteImageSchema>;
export type QuoteImage = typeof quoteImages.$inferSelect;

// Enquiries table
export const enquiries = pgTable("enquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  userId: varchar("user_id").notNull(),
  enquiryTitle: text("enquiry_title").notNull(),
  holidayType: text("holiday_type").notNull(),
  country: text("country"),
  destination: text("destination"),
  resort: text("resort"),
  departureAirport: text("departure_airport"),
  travelDate: text("travel_date"),
  flexibility: text("flexibility"),
  passengersAdults: integer("passengers_adults").notNull().default(2),
  passengersChildren: integer("passengers_children").notNull().default(0),
  passengersInfants: integer("passengers_infants").notNull().default(0),
  nights: integer("nights"),
  starRating: text("star_rating"),
  boardBasis: text("board_basis"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  budgetType: text("budget_type").default("Per Person"),
  status: text("status").notNull().default("Open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEnquirySchema = createInsertSchema(enquiries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;
export type Enquiry = typeof enquiries.$inferSelect;

// Enquiry Notes table
export const enquiryNotes = pgTable("enquiry_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enquiryId: varchar("enquiry_id").notNull(),
  parentId: varchar("parent_id"),
  content: text("content").notNull(),
  authorName: text("author_name").notNull().default("Agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertEnquiryNoteSchema = createInsertSchema(enquiryNotes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEnquiryNote = z.infer<typeof insertEnquiryNoteSchema>;
export type EnquiryNote = typeof enquiryNotes.$inferSelect;

// Notes table
export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id"),
  content: text("content").notNull(),
  authorName: text("author_name").notNull().default("Agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertNoteSchema = createInsertSchema(notes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

// Tour Operators table
export const tourOperators = pgTable("tour_operators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  holidayType: text("holiday_type").notNull(),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }).notNull().default("10"),
  username: text("username"),
  password: text("password"),
  contact: text("contact"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTourOperatorSchema = createInsertSchema(tourOperators).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTourOperator = z.infer<typeof insertTourOperatorSchema>;
export type TourOperator = typeof tourOperators.$inferSelect;

// Airports table
export const airports = pgTable("airports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull(),
  country: text("country").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAirportSchema = createInsertSchema(airports).omit({ id: true, createdAt: true });
export type InsertAirport = z.infer<typeof insertAirportSchema>;
export type Airport = typeof airports.$inferSelect;

// Tickets table
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // Admin, Build, Sales
  status: text("status").notNull().default("Open"), // Open, In Progress, Resolved, Closed
  priority: text("priority").notNull().default("Medium"), // Low, Medium, High, Urgent
  subject: text("subject").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// Ticket Attachments table
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

// Ticket Replies table
export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  parentReplyId: varchar("parent_reply_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTicketReplySchema = createInsertSchema(ticketReplies).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;
export type TicketReply = typeof ticketReplies.$inferSelect;

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // ticket_reply, ticket_assigned, ticket_updated, ticket_resolved
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Favorites / Pinned items
export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(), // client, quote, enquiry
  itemId: varchar("item_id").notNull(),
  label: text("label").notNull(),
  subtitle: text("subtitle"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({ id: true, createdAt: true });
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

// Neon Client Table (from external Neon database)
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
  referrerId: text(),
});

export const insertClientTableSchema = createInsertSchema(clientTable).omit({ id: true, createdAt: true });
export type InsertClientTable = z.infer<typeof insertClientTableSchema>;
export type NeonClient = typeof clientTable.$inferSelect;

// ==========================================
// Lookup / Reference Tables (for data import)
// ==========================================

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

export const owner_type_enum = pgEnum('owner_type_enum', ['package_holiday', 'hot_tub_break', 'cruise']);
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
}, (table) => [
  unique('year_month_idx').on(table.year, table.month),
  index('year_month_index').on(table.year, table.month),
])
export type ForwardsReport = typeof forwardsReport.$inferSelect;
export type InsertForwardsReport = typeof forwardsReport.$inferInsert;
