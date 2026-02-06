import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index, jsonb, uuid, date } from "drizzle-orm/pg-core";
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
