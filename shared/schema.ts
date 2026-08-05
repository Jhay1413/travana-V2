import { sql, relations } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, integer, bigint, decimal, numeric, timestamp, boolean, index, jsonb, uuid, date, unique, uniqueIndex, vector, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transaction_status_enum = pgEnum('transaction_status_enum', ['on_enquiry', 'on_quote', 'on_booking']);
export const lead_source_enum = pgEnum('lead_source_enum', ['SHOP', 'FACEBOOK', 'WHATSAPP', 'INSTAGRAM', 'PHONE_ENQUIRY']);
export const enquiry_status_enum = pgEnum('enquiry_status_enum', ['NEW_LEAD', 'ACTIVE', 'LOST', 'INACTIVE', 'EXPIRED']);
export const budget_type_enum = pgEnum('budget_type_enum', ['PER_PERSON', 'PACKAGE']);
export const quote_status_enum = pgEnum('quote_status_enum', ['quoted', 'in_play', 'lost', 'archived']);
export const booking_status_enum = pgEnum('booking_status_enum', ['BOOKED', 'LOST']);
export const referral_status_enum = pgEnum('referral_status_enum', ['PENDING', 'IN_WALLET', 'PAID', 'VOIDED']);
export const referral_request_status_enum = pgEnum('referral_request_status_enum', ['PENDING', 'APPROVED', 'REJECTED']);
export const owner_type_enum = pgEnum('owner_type_enum', ['package_holiday', 'hot_tub_break', 'cruise']);
export const vip_tier_enum = pgEnum('vip_tier_enum', ['standard', 'gold', 'elite']);
export const withdrawal_method_enum = pgEnum('withdrawal_method_enum', ['bank_transfer', 'booking_credit']);
export const referral_payout_status_enum = pgEnum('referral_payout_status_enum', ['requested', 'approved', 'rejected']);
export const referral_withdrawal_status_enum = pgEnum('referral_withdrawal_status_enum', ['pending', 'processed', 'rejected']);

// ─── Training / LMS ───────────────────────────────────────────────────────────
export const course_status_enum = pgEnum('course_status_enum', ['draft', 'published', 'archived']);
export const course_visibility_enum = pgEnum('course_visibility_enum', ['global', 'org']);
export const lesson_type_enum = pgEnum('lesson_type_enum', ['video', 'graphics']);
export const question_type_enum = pgEnum('question_type_enum', ['single', 'multiple']);
export const enrollment_status_enum = pgEnum('enrollment_status_enum', ['in_progress', 'completed']);

// ─── Multi-tenancy: Organizations & Branches ─────────────────────────────────

export const organization = pgTable("organization", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  plan: varchar("plan").default("starter"),
  isActive: boolean("is_active").notNull().default(true),
  seatLimit: integer("seat_limit").default(10),
  brandColor: varchar("brand_color"),
  logoUrl: varchar("logo_url"),
  settings: jsonb("settings").default(sql`'{}'`),
  homeworkerCommission: integer("homeworker_commission"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  trialEndsAt: timestamp("trial_ends_at"),
  monthlySmsCreditLimit: integer("monthly_sms_credit_limit").notNull().default(100),
  smsOveragePriceCents:  integer("sms_overage_price_cents").notNull().default(5),
  smsCreditsEnabled:     boolean("sms_credits_enabled").notNull().default(true),
});

export const insertOrganizationSchema = createInsertSchema(organization).omit({ id: true, createdAt: true });
export type Organization = typeof organization.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export const branches = pgTable("branches", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  code: varchar("code"),
  address: text("address"),
  phone: varchar("phone"),
  email: varchar("email"),
  openingPattern: varchar("opening_pattern"),
  bankHolidaysOpen: boolean("bank_holidays_open").notNull().default(false),
  openingHours: jsonb("opening_hours").default(sql`'[]'`),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  branchType: varchar("branch_type", { length: 16 }).notNull().default("shop"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  idx_branches_org: index("idx_branches_org_id").on(table.organizationId),
}));

export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true });
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;

export const plans = pgTable("plans", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  code: varchar("code").notNull().unique(),
  name: varchar("name").notNull(),
  branchLimit: integer("branch_limit"),
  seatLimit: integer("seat_limit"),
  priceCents: integer("price_cents").notNull().default(0),
  features: jsonb("features").default(sql`'{}'`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plans).omit({ id: true, createdAt: true });
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;

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
  password: text("password"),
  resetToken: text("resetToken"),
  resetTokenExpiry: timestamp("resetTokenExpiry"),
  inviteToken: text("inviteToken"),
  inviteTokenExpiry: timestamp("inviteTokenExpiry"),
  invitedBy: text("invitedBy"),
  invitedAt: timestamp("invitedAt"),
  inviteAgencyName: text("inviteAgencyName"),
  orgId: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  orgRole: varchar("org_role"),
  verificationToken: text("verification_token"),
  verificationTokenExpiry: timestamp("verification_token_expiry"),
});

export const insertUserSchema = createInsertSchema(user).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof user.$inferInsert;
export type User = typeof user.$inferSelect;

export const branchMembers = pgTable("branch_members", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  orgRole: varchar("org_role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (table) => ({
  unique_branch_user: unique().on(table.branchId, table.userId),
  idx_branch_members_org: index("idx_branch_members_org_id").on(table.orgId),
  idx_branch_members_branch: index("idx_branch_members_branch_id").on(table.branchId),
  idx_branch_members_user: index("idx_branch_members_user_id").on(table.userId),
}));

export const insertBranchMemberSchema = createInsertSchema(branchMembers).omit({ id: true, joinedAt: true });
export type BranchMember = typeof branchMembers.$inferSelect;
export type InsertBranchMember = z.infer<typeof insertBranchMemberSchema>;

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio"),
  extendedBio: text("extended_bio"),
  location: text("location"),
  specialisation: text("specialisation"),
  certifications: text("certifications"),
  coverImage: text("cover_image"),
  address: text("address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactRelationship: text("emergency_contact_relationship"),
  emergencyContactPhone: text("emergency_contact_phone"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

export const client_status_enum = pgEnum("client_status", ["active", "merged"]);

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
  // Per-client opt-in for the SendSeven AI auto-reply: the bot only replies in
  // a conversation when it is linked to a client with this ON (or the
  // conversation itself carries an explicit agent override — see
  // sendseven_conversation_state.ai_override). Defaults OFF: new/unlinked
  // conversations get no AI until an agent opts them in.
  aiReplyEnabled: boolean("ai_reply_enabled").notNull().default(false),
  portalPin: varchar("portal_pin"),
  // True when portalPin is a system-seeded default (e.g. from a quote SMS) that
  // the client must replace on first portal entry.
  mustChangePin: boolean("must_change_pin").notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
  referrerId: text("referrerId").references(() => user.id, { onDelete: "set null" }),
  orgId: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  vipTier: vip_tier_enum("vipTier"),
  vipEnrolledAt: timestamp("vipEnrolledAt"),
  totalReferrals: integer("totalReferrals").default(0).notNull(),
  referredByClientId: uuid("referredByClientId"),
  // Per-referrer share of a referred booking's commission (percent, default 25).
  referralCommissionRate: numeric("referral_commission_rate").default("25").notNull(),
  smsOptIn: boolean("sms_opt_in").notNull().default(true),
  // Duplicate-resolution: a "merged" client has had all its records reassigned
  // to mergedIntoId and is hidden from normal lists. See client_merge_log.
  status: client_status_enum("status").notNull().default("active"),
  mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => clientTable.id, { onDelete: "set null" }),
  mergedAt: timestamp("merged_at"),
  mergedBy: text("merged_by").references(() => user.id, { onDelete: "set null" }),
});

export const insertClientTableSchema = createInsertSchema(clientTable).omit({ id: true, createdAt: true });
export type InsertClientTable = z.infer<typeof insertClientTableSchema>;
export type NeonClient = typeof clientTable.$inferSelect;

// Audit trail: one row per client merge. sourceClientId has no FK so the log
// survives even if the archived source is ever hard-deleted later.
export const clientMergeLog = pgTable("client_merge_log", {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  sourceClientId: uuid("source_client_id").notNull(),
  targetClientId: uuid("target_client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  mergedBy: text("merged_by").references(() => user.id, { onDelete: "set null" }),
  orgId: uuid("org_id"),
  branchId: uuid("branch_id"),
  counts: jsonb("counts"),
  createdAt: timestamp().notNull().defaultNow(),
});

export const insertClientMergeLogSchema = createInsertSchema(clientMergeLog).omit({ id: true, createdAt: true });
export type InsertClientMergeLog = z.infer<typeof insertClientMergeLogSchema>;
export type ClientMergeLog = typeof clientMergeLog.$inferSelect;

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
  commission_percentage: decimal({ precision: 5, scale: 2 }),
  org_id: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  logo_url: text("logo_url"),
});
export type TourOperatorLookup = typeof tour_operator.$inferSelect;
export type InsertTourOperatorLookup = typeof tour_operator.$inferInsert;

// Per-organization, per-supplier scraper configuration. Each row lets one org
// scrape one supplier (easyJet, TUI, …): login credentials (encrypted via
// utils/encryption) plus a `config` JSON that drives the config-driven scraper
// engine (adapter type, browser/proxy, auth selectors, API endpoints).
export const supplier_scraper = pgTable('supplier_scraper', {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  org_id: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  // Optional link to the tour_operator catalog row (commission, display name).
  tour_operator_id: uuid("tour_operator_id").references(() => tour_operator.id, { onDelete: "set null" }),
  // Stable identifier used to match a pasted URL to this config (e.g. "easyjet").
  supplier_key: varchar("supplier_key").notNull(),
  supplier_name: varchar("supplier_name").notNull(),
  // Which code adapter interprets the config (see scraper-engine.types.ts).
  adapter_type: varchar("adapter_type").notNull().default('easyjet'),
  // Encrypted JSON: { username, password, apiKey }.
  encrypted_credentials: text("encrypted_credentials"),
  // ScraperConfig JSON (browser, auth, fetch, deepLink) minus credentials.
  config: jsonb("config").default(sql`'{}'`),
  // Encrypted JSON array of the browser cookies captured after a successful
  // login, so later scrapes can restore the session and skip the (slow) login.
  // Self-healing: if restored cookies have expired the scraper logs in again and
  // overwrites this. Encrypted because these are live session tokens.
  session_state: text("session_state"),
  session_saved_at: timestamp("session_saved_at"),
  is_active: boolean("is_active").notNull().default(true),
  created_by_user_id: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
}, (table) => [
  // One config per supplier per org.
  unique("uq_supplier_scraper_org_supplier").on(table.org_id, table.supplier_key),
  index("idx_supplier_scraper_org").on(table.org_id),
]);
export type SupplierScraper = typeof supplier_scraper.$inferSelect;
export type InsertSupplierScraper = typeof supplier_scraper.$inferInsert;

export const package_type = pgTable('package_type_table', {
  id: uuid()
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
  name: varchar().notNull(),
});
export type PackageType = typeof package_type.$inferSelect;
export type InsertPackageType = typeof package_type.$inferInsert;

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

export const accommodation_images = pgTable('accommodation_images', {
  id: uuid().defaultRandom().primaryKey(),
  accommodation_id: uuid().notNull().references(() => accomodation_list.id, { onDelete: "cascade" }),
  image_url: varchar().notNull(),
  isPrimary: boolean().default(false),
}, (table) => ({
  accommodation_image_unique: unique().on(table.accommodation_id, table.image_url),
}));
export type AccommodationImage = typeof accommodation_images.$inferSelect;
export type InsertAccommodationImage = typeof accommodation_images.$inferInsert;

export const lodge_images = pgTable('lodge_images', {
  id: uuid().defaultRandom().primaryKey(),
  lodge_id: uuid().notNull().references(() => lodges.id, { onDelete: "cascade" }),
  image_url: varchar().notNull(),
  isPrimary: boolean().default(false),
}, (table) => ({
  lodge_image_unique: unique().on(table.lodge_id, table.image_url),
}));
export type LodgeImage = typeof lodge_images.$inferSelect;
export type InsertLodgeImage = typeof lodge_images.$inferInsert;

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
  // Upsells (by `added_at` calendar month) contributing to this month's total,
  // mirroring deal_ids for auditability/idempotency of the precomputed row.
  upsell_ids: text().array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  historical_ids: text().array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  org_id: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  branch_id: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
}, (table) => ({
  // Report rows are per-org; org_id IS NULL holds the platform-wide (all orgs)
  // report written by platform admins. NULLs are distinct in Postgres unique
  // constraints, so the app-level upsert in revenue.repository is what keeps
  // the NULL-org rows singular per (year, month).
  unique_org_year_month: unique('forwards_report_org_year_month_unique').on(table.org_id, table.year, table.month),
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
  sub_description: varchar(),
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
  is_test: boolean().default(false),
  client_id: uuid().references(() => clientTable.id),
  lead_source: lead_source_enum().default('SHOP'),
  user_id: text().notNull().references(() => user.id),
  created_at: timestamp().notNull().defaultNow(),
  org_id: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  branch_id: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
}, (table) => [
  // Pipeline board filters by status (+created_at sort) for the all-agents view,
  // and by user_id for the default per-agent view. See findPipelineByStatus.
  index("idx_transaction_status_created").on(table.status, table.created_at),
  index("idx_transaction_user_status_created").on(table.user_id, table.status, table.created_at),
]);

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
  flexible_nights: integer().array().default(sql`ARRAY[]::integer[]`),
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
  parent_quote_id: uuid().references((): AnyPgColumn => quote.id),
  isFreeQuote: boolean().default(false),
  quote_token: varchar('quote_token', { length: 12 }),
  quote_sent_at: timestamp('quote_sent_at', { precision: 0, withTimezone: true }),
  quote_sent_via: varchar('quote_sent_via'),
  show_on_portal: boolean('show_on_portal').default(false),
  // Timestamp of when the quote was (last) added to the portal as a deal — set when
  // show_on_portal flips to true. Drives the "Latest Deals" 6-day recency window.
  portal_added_at: timestamp('portal_added_at', { precision: 0, withTimezone: true }),
  is_featured: boolean('is_featured').default(false),
  not_for_social: boolean('not_for_social').default(false),
}, (table) => [
  // Pipeline subqueries resolve quotes per transaction and filter by status;
  // leading transaction_id also serves the inArray(transaction_id) enrich lookups.
  index("idx_quote_transaction_status").on(table.transaction_id, table.quote_status),
]);

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
}, (table) => [index("idx_quote_flights_quote_id").on(table.quote_id)]);
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
}, (table) => [index("idx_quote_accomodation_quote_id").on(table.quote_id)]);
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
}, (table) => [index("idx_quote_transfers_quote_id").on(table.quote_id)]);
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
}, (table) => [index("idx_quote_car_hire_quote_id").on(table.quote_id)]);
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
}, (table) => [index("idx_quote_attraction_ticket_quote_id").on(table.quote_id)]);
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
}, (table) => [index("idx_quote_lounge_pass_quote_id").on(table.quote_id)]);
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
}, (table) => [index("idx_quote_airport_parking_quote_id").on(table.quote_id)]);
export type QuoteAirportParking = typeof quote_airport_parking.$inferSelect;
export type InsertQuoteAirportParking = typeof quote_airport_parking.$inferInsert;

export const quote_cruise = pgTable('quote_cruise', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  tour_operator_id: uuid().references(() => tour_operator.id),
  cruise_line: varchar(),
  ship: varchar(),
  cruise_date: date(),
  cabin_type: varchar(),
  cabin_number: varchar(),
  embarkation: varchar(),
  debarkation: varchar(),
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
  sub_description: varchar(),
});
export type QuoteCruiseItinerary = typeof quote_cruise_itinerary.$inferSelect;
export type InsertQuoteCruiseItinerary = typeof quote_cruise_itinerary.$inferInsert;

export const booking = pgTable('booking_table', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  transaction_id: uuid().notNull().references(() => transaction.id, { onDelete: "cascade" }).unique(),
  quote_id: uuid().references(() => quote.id),
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
  wallet_credit: numeric({ precision: 10, scale: 2 }).default("0.00"),
  num_of_nights: integer().notNull().default(0),
  pets: integer().notNull().default(0),
  cottage_id: uuid().references(() => cottages.id),
  lodge_id: uuid().references(() => lodges.id),
  lodge_type: varchar(),
  transfer_type: varchar(),
  infant: integer().notNull().default(0),
  child: integer().notNull().default(0),
  adult: integer().notNull().default(0),
  price_per_person: numeric('price_per_person', { precision: 10, scale: 2 }).default("0.00").notNull(),
  booking_status: booking_status_enum(),
  main_tour_operator_id: uuid().references(() => tour_operator.id),
  date_created: timestamp({ withTimezone: true }).defaultNow(),
  deletion_code: varchar(),
  deleted_by: uuid("deleted_by"),
  deleted_by_user: text("deleted_by_user").references(() => user.id),
  deleted_at: timestamp({ precision: 0, withTimezone: true }).defaultNow(),
}, (table) => [
  // on_booking pipeline column filters bookings to the current month by date_created.
  // (transaction_id already carries a unique index from its .unique() constraint.)
  index("idx_booking_date_created").on(table.date_created),
]);

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
}, (table) => [index("idx_booking_flights_booking_id").on(table.booking_id)]);
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
}, (table) => [index("idx_booking_accomodation_booking_id").on(table.booking_id)]);
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
}, (table) => [index("idx_booking_transfers_booking_id").on(table.booking_id)]);
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
}, (table) => [index("idx_booking_car_hire_booking_id").on(table.booking_id)]);
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
}, (table) => [index("idx_booking_attraction_ticket_booking_id").on(table.booking_id)]);
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
}, (table) => [index("idx_booking_lounge_pass_booking_id").on(table.booking_id)]);
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
}, (table) => [index("idx_booking_airport_parking_booking_id").on(table.booking_id)]);
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
  cabin_number: varchar(),
  embarkation: varchar(),
  debarkation: varchar(),
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
  sub_description: varchar(),
});
export type BookingCruiseItinerary = typeof booking_cruise_itinerary.$inferSelect;
export type InsertBookingCruiseItinerary = typeof booking_cruise_itinerary.$inferInsert;

// Upsells: extra line items added to a booking AFTER it was created (e.g. extra
// hotel nights bought a month later). Deliberately separate from the booking_*
// line-item tables so `totalBookingCommissionExpr()` does NOT sweep them into
// the booking's creation/travel-month profit — their commission is recognised
// independently by `added_at` (see server/v2/utils/commission-sql.ts).
export const booking_upsell = pgTable('booking_upsell', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  booking_id: uuid().notNull().references(() => booking.id, { onDelete: "cascade" }),
  upsell_type: varchar().notNull(), // EXTRA_NIGHTS | TRANSFER | LOUNGE | PARKING | FEE | OTHER
  description: varchar(),
  quantity: integer().notNull().default(1),
  cost: numeric({ precision: 10, scale: 2 }),
  commission: numeric({ precision: 10, scale: 2 }), // manual; the profit recognised
  sales_price: numeric({ precision: 10, scale: 2 }),
  tour_operator_id: uuid().references(() => tour_operator.id, { onDelete: "set null" }),
  added_at: timestamp({ withTimezone: true }).defaultNow(), // recognition date (the month it lands in)
  added_by: text().references(() => user.id),
  is_active: boolean().default(true), // soft delete
  created_at: timestamp({ withTimezone: true }).defaultNow(),
  updated_at: timestamp({ withTimezone: true }).defaultNow(),
});
export type BookingUpsell = typeof booking_upsell.$inferSelect;
export type InsertBookingUpsell = typeof booking_upsell.$inferInsert;

export const notes = pgTable('notes', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  description: varchar(),
  content: text(),
  agent_id: text().references(() => user.id),
  user_id: text().references(() => user.id),
  createdAt: timestamp("created_at", { mode: 'string' }).notNull().defaultNow(),
  parent_id: varchar(),
  transaction_id: uuid().references(() => transaction.id, { onDelete: "cascade" }),
  client_id: uuid("client_id").references(() => clientTable.id, { onDelete: "set null" }),
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
  org_id: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  branch_id: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
});

export const insertTaskSchema = createInsertSchema(task).omit({ id: true, created_at: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof task.$inferSelect;

export const referral = pgTable('referral', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  referrerClientId: uuid("referrerClientId").references(() => clientTable.id, { onDelete: "set null" }),
  referredClientId: uuid("referredClientId").references(() => clientTable.id, { onDelete: "set null" }),
  transactionId: uuid("transactionId").references(() => transaction.id, { onDelete: "set null" }),
  referredName: varchar("referredName").notNull(),
  referredEmail: varchar("referredEmail"),
  referredPhone: varchar("referredPhone"),
  referralStatus: referral_status_enum("referralStatus").default('PENDING').notNull(),
  commission: numeric("commission"),
  // Snapshot of the referrer's rate (percent) at creation, so historical payouts
  // stay stable if the referrer's rate later changes.
  commissionRate: numeric("commissionRate"),
  payoutAmount: numeric("payoutAmount"),
  travelDate: date("travelDate"),
  payoutTriggerDate: date("payoutTriggerDate"),
  paidAt: timestamp("paidAt"),
  payoutType: varchar("payoutType"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const insertReferralSchema = createInsertSchema(referral).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referral.$inferSelect;

// Tracks the client payout request lifecycle (client requests → admin approves/rejects → wallet credited)
export const referral_payout = pgTable('referral_payout', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  referral_id: uuid("referral_id").references(() => referral.id, { onDelete: "cascade" }).notNull(),
  client_id: uuid("client_id").references(() => clientTable.id, { onDelete: "set null" }),
  amount: numeric("amount").notNull(),
  status: referral_payout_status_enum("status").default('requested').notNull(),
  notes: varchar("notes"),
  requested_at: timestamp("requested_at").defaultNow(),
  approved_at: timestamp("approved_at"),
  rejected_at: timestamp("rejected_at"),
});

export const insertReferralPayoutSchema = createInsertSchema(referral_payout).omit({ id: true, requested_at: true });
export type InsertReferralPayout = z.infer<typeof insertReferralPayoutSchema>;
export type ReferralPayout = typeof referral_payout.$inferSelect;

// Tracks the client withdrawal request (bank transfer or booking credit)
export const referral_withdrawal = pgTable('referral_withdrawal', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  referral_id: uuid("referral_id").references(() => referral.id, { onDelete: "cascade" }).notNull(),
  client_id: uuid("client_id").references(() => clientTable.id, { onDelete: "set null" }),
  amount: numeric("amount").notNull(),
  method: withdrawal_method_enum("method").notNull(),
  status: referral_withdrawal_status_enum("status").default('pending').notNull(),
  // Bank transfer fields
  account_name: varchar("account_name"),
  account_number: varchar("account_number"),
  sort_code: varchar("sort_code"),
  transfer_reference: varchar("transfer_reference"),
  // Booking credit fields
  booking_id: uuid("booking_id").references(() => booking.id, { onDelete: "set null" }),
  credit_note: varchar("credit_note"),
  // General
  notes: varchar("notes"),
  invoice_url: text("invoice_url"),
  requested_at: timestamp("requested_at").defaultNow(),
  processed_at: timestamp("processed_at"),
});

export const insertReferralWithdrawalSchema = createInsertSchema(referral_withdrawal).omit({ id: true, requested_at: true });
export type InsertReferralWithdrawal = z.infer<typeof insertReferralWithdrawalSchema>;
export type ReferralWithdrawal = typeof referral_withdrawal.$inferSelect;

// ── Wallet Ledger ─────────────────────────────────────────────────────────────
// Replaces per-referral referral_withdrawal with a proper debit/credit ledger.
// Credits are created when a referral moves to IN_WALLET.
// Debits are created when booking credit or bank transfer is requested.
export const wallet_transaction_type_enum = pgEnum('wallet_transaction_type_enum', ['credit', 'debit']);
export const wallet_transaction_source_enum = pgEnum('wallet_transaction_source_enum', ['referral_commission', 'booking_credit', 'bank_transfer']);
export const wallet_transaction_status_enum = pgEnum('wallet_transaction_status_enum', ['pending', 'processed', 'rejected']);

export const wallet_transaction = pgTable('wallet_transaction', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  client_id: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  type: wallet_transaction_type_enum("type").notNull(),
  amount: numeric("amount").notNull(),
  source: wallet_transaction_source_enum("source").notNull(),
  referral_id: uuid("referral_id").references(() => referral.id, { onDelete: "set null" }),
  booking_id: uuid("booking_id").references(() => booking.id, { onDelete: "set null" }),
  account_name: varchar("account_name"),
  account_number: varchar("account_number"),
  sort_code: varchar("sort_code"),
  transfer_reference: varchar("transfer_reference"),
  notes: text("notes"),
  invoice_url: text("invoice_url"),
  status: wallet_transaction_status_enum("status").default('pending').notNull(),
  created_at: timestamp("created_at").defaultNow(),
  processed_at: timestamp("processed_at"),
});

export const insertWalletTransactionSchema = createInsertSchema(wallet_transaction).omit({ id: true, created_at: true });
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof wallet_transaction.$inferSelect;

export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: uuid("client_id").references(() => clientTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id),
  assignedTo: text("assigned_to").references(() => user.id),
  type: text("type").notNull(),
  status: text("status").notNull().default("Open"),
  priority: text("priority").notNull().default("Medium"),
  subject: text("subject").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  orgId: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
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

export const clientFiles = pgTable("client_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  title: text("title"),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  category: text("category"),
  allocationType: text("allocation_type"),
  allocationId: text("allocation_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientFileSchema = createInsertSchema(clientFiles).omit({ id: true, createdAt: true });
export type InsertClientFile = z.infer<typeof insertClientFileSchema>;
export type ClientFile = typeof clientFiles.$inferSelect;

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

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
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
  // Display order within the quote's gallery, ascending. `id` is a random UUID
  // so it carries no insertion sequence — without this column the order the DB
  // returns is arbitrary and can shift. Images merged in from the shared
  // accommodation/lodge libraries have no per-quote row, so they sort after
  // these (see quote.repository `images`).
  position: integer("position").notNull().default(0),
});

export const insertQuoteImageSchema = createInsertSchema(quoteImages);
export type QuoteImage = typeof quoteImages.$inferSelect;
export type InsertQuoteImage = z.infer<typeof insertQuoteImageSchema>;

export const bookingImages = pgTable("booking_images", {
  id: varchar("id").primaryKey(),
  bookingId: uuid("booking_id").references(() => booking.id, { onDelete: 'cascade' }),
  url: text("url"),
  isPrimary: boolean("is_primary"),
  /** Display order within the booking's gallery — see quoteImages.position. */
  position: integer("position").notNull().default(0),
});

export const insertBookingImageSchema = createInsertSchema(bookingImages);
export type BookingImage = typeof bookingImages.$inferSelect;
export type InsertBookingImage = z.infer<typeof insertBookingImageSchema>;

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
});

export const insertTagSchema = createInsertSchema(tags);
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export const quoteTags = pgTable("quote_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull().references(() => quote.id, { onDelete: 'cascade' }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  unique_quote_tag: unique().on(table.quoteId, table.tagId)
}));

export const insertQuoteTagSchema = createInsertSchema(quoteTags);
export type QuoteTag = typeof quoteTags.$inferSelect;
export type InsertQuoteTag = z.infer<typeof insertQuoteTagSchema>;

export const clientTags = pgTable("client_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: 'cascade' }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  unique_client_tag: unique().on(table.clientId, table.tagId)
}));

export const insertClientTagSchema = createInsertSchema(clientTags);
export type ClientTag = typeof clientTags.$inferSelect;
export type InsertClientTag = z.infer<typeof insertClientTagSchema>;

export const bookingTags = pgTable("booking_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").notNull().references(() => booking.id, { onDelete: 'cascade' }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  unique_booking_tag: unique().on(table.bookingId, table.tagId)
}));

export const insertBookingTagSchema = createInsertSchema(bookingTags);
export type BookingTag = typeof bookingTags.$inferSelect;
export type InsertBookingTag = z.infer<typeof insertBookingTagSchema>;

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
  orgId: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
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
  orgId: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
});

export const insertTasksSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export type TaskNew = typeof tasks.$inferSelect;
export type InsertTaskNew = z.infer<typeof insertTasksSchema>;

// ============================================================
// === Training / LMS ===
// Udemy-style courses: course → sections → lessons (video/graphics), with
// quizzes attachable per lesson, per section, or course-level (the final
// quiz). `org_id IS NULL` on training_course means the course is global
// (visible to every tenant); see docs/training-lms-plan.md.
// ============================================================

export const training_course = pgTable('training_course', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  org_id: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  branch_id: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  visibility: course_visibility_enum("visibility").notNull().default('global'),
  // Free-text so new categories can be added without a migration. Seeded set:
  // Sales, Supplier, Resort, Platform (the client offers these as a dropdown).
  category: text("category").notNull().default('Sales'),
  title: varchar("title").notNull(),
  description: text("description"),
  thumbnail_url: text("thumbnail_url"),
  status: course_status_enum("status").notNull().default('draft'),
  passing_score: integer("passing_score").notNull().default(80),
  require_content_before_quiz: boolean("require_content_before_quiz").notNull().default(true),
  created_by: text("created_by").references(() => user.id, { onDelete: "set null" }),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingCourseSchema = createInsertSchema(training_course).omit({ id: true, created_at: true, updated_at: true });
export type TrainingCourse = typeof training_course.$inferSelect;
export type InsertTrainingCourse = z.infer<typeof insertTrainingCourseSchema>;

export const training_section = pgTable('training_section', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  course_id: uuid("course_id").notNull().references(() => training_course.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingSectionSchema = createInsertSchema(training_section).omit({ id: true, created_at: true, updated_at: true });
export type TrainingSection = typeof training_section.$inferSelect;
export type InsertTrainingSection = z.infer<typeof insertTrainingSectionSchema>;

export const training_lesson = pgTable('training_lesson', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  // course_id is denormalized (derivable via the section) so progress/quiz
  // queries can stay keyed by course without an extra join.
  course_id: uuid("course_id").notNull().references(() => training_course.id, { onDelete: "cascade" }),
  section_id: uuid("section_id").notNull().references(() => training_section.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  description: text("description"),
  type: lesson_type_enum("type").notNull(),
  // Ordering within the lesson's section (sections themselves order by their own position).
  position: integer("position").notNull().default(0),
  is_required: boolean("is_required").notNull().default(true),
  video_url: text("video_url"),
  video_duration_sec: integer("video_duration_sec"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingLessonSchema = createInsertSchema(training_lesson).omit({ id: true, created_at: true, updated_at: true });
export type TrainingLesson = typeof training_lesson.$inferSelect;
export type InsertTrainingLesson = z.infer<typeof insertTrainingLessonSchema>;

export const training_lesson_asset = pgTable('training_lesson_asset', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  lesson_id: uuid("lesson_id").notNull().references(() => training_lesson.id, { onDelete: "cascade" }),
  asset_url: text("asset_url").notNull(),
  caption: text("caption"),
  position: integer("position").notNull().default(0),
});

export const insertTrainingLessonAssetSchema = createInsertSchema(training_lesson_asset).omit({ id: true });
export type TrainingLessonAsset = typeof training_lesson_asset.$inferSelect;
export type InsertTrainingLessonAsset = z.infer<typeof insertTrainingLessonAssetSchema>;

export const training_quiz = pgTable('training_quiz', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  course_id: uuid("course_id").notNull().references(() => training_course.id, { onDelete: "cascade" }),
  // Quiz attachment point — at most one of lesson_id / section_id is set
  // (CHECK below): lesson_id = a per-lesson quiz (one per lesson),
  // section_id = a per-section quiz (one per section), both NULL = the
  // course-level "final" quiz (at most one per course, via the partial
  // unique index below).
  lesson_id: uuid("lesson_id").unique().references(() => training_lesson.id, { onDelete: "cascade" }),
  section_id: uuid("section_id").unique().references(() => training_section.id, { onDelete: "cascade" }),
  title: varchar("title"),
  shuffle_questions: boolean("shuffle_questions").notNull().default(false),
  // Lesson/section quizzes only: when true, content progress alone cannot
  // complete the lesson/section — the learner must pass this quiz. Always
  // false on final quizzes.
  is_required: boolean("is_required").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  course_final_quiz_unique: uniqueIndex('training_quiz_course_final_unique')
    .on(table.course_id)
    .where(sql`${table.lesson_id} IS NULL AND ${table.section_id} IS NULL`),
  single_target_check: check(
    'training_quiz_single_target_check',
    sql`${table.lesson_id} IS NULL OR ${table.section_id} IS NULL`,
  ),
}));

export const insertTrainingQuizSchema = createInsertSchema(training_quiz).omit({ id: true, created_at: true, updated_at: true });
export type TrainingQuiz = typeof training_quiz.$inferSelect;
export type InsertTrainingQuiz = z.infer<typeof insertTrainingQuizSchema>;

export const training_question = pgTable('training_question', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quiz_id: uuid("quiz_id").notNull().references(() => training_quiz.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  type: question_type_enum("type").notNull().default('single'),
  position: integer("position").notNull().default(0),
  points: integer("points").notNull().default(1),
});

export const insertTrainingQuestionSchema = createInsertSchema(training_question).omit({ id: true });
export type TrainingQuestion = typeof training_question.$inferSelect;
export type InsertTrainingQuestion = z.infer<typeof insertTrainingQuestionSchema>;

export const training_choice = pgTable('training_choice', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  question_id: uuid("question_id").notNull().references(() => training_question.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  is_correct: boolean("is_correct").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const insertTrainingChoiceSchema = createInsertSchema(training_choice).omit({ id: true });
export type TrainingChoice = typeof training_choice.$inferSelect;
export type InsertTrainingChoice = z.infer<typeof insertTrainingChoiceSchema>;

export const training_enrollment = pgTable('training_enrollment', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  course_id: uuid("course_id").notNull().references(() => training_course.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  org_id: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  status: enrollment_status_enum("status").notNull().default('in_progress'),
  enrolled_at: timestamp("enrolled_at").notNull().defaultNow(),
  completed_at: timestamp("completed_at"),
}, (table) => ({
  unique_course_user: unique().on(table.course_id, table.user_id),
}));

export const insertTrainingEnrollmentSchema = createInsertSchema(training_enrollment).omit({ id: true, enrolled_at: true });
export type TrainingEnrollment = typeof training_enrollment.$inferSelect;
export type InsertTrainingEnrollment = z.infer<typeof insertTrainingEnrollmentSchema>;

export const training_lesson_progress = pgTable('training_lesson_progress', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  enrollment_id: uuid("enrollment_id").notNull().references(() => training_enrollment.id, { onDelete: "cascade" }),
  lesson_id: uuid("lesson_id").notNull().references(() => training_lesson.id, { onDelete: "cascade" }),
  completed: boolean("completed").notNull().default(false),
  progress_pct: integer("progress_pct").notNull().default(0),
  last_viewed_at: timestamp("last_viewed_at"),
}, (table) => ({
  unique_enrollment_lesson: unique().on(table.enrollment_id, table.lesson_id),
}));

export const insertTrainingLessonProgressSchema = createInsertSchema(training_lesson_progress).omit({ id: true });
export type TrainingLessonProgress = typeof training_lesson_progress.$inferSelect;
export type InsertTrainingLessonProgress = z.infer<typeof insertTrainingLessonProgressSchema>;

export const training_quiz_attempt = pgTable('training_quiz_attempt', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  enrollment_id: uuid("enrollment_id").notNull().references(() => training_enrollment.id, { onDelete: "cascade" }),
  quiz_id: uuid("quiz_id").notNull().references(() => training_quiz.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  attempt_number: integer("attempt_number").notNull().default(1),
  score_pct: integer("score_pct"),
  passed: boolean("passed"),
  answers_snapshot: jsonb("answers_snapshot"),
  started_at: timestamp("started_at").notNull().defaultNow(),
  submitted_at: timestamp("submitted_at"),
});

export const insertTrainingQuizAttemptSchema = createInsertSchema(training_quiz_attempt).omit({ id: true, started_at: true });
export type TrainingQuizAttempt = typeof training_quiz_attempt.$inferSelect;
export type InsertTrainingQuizAttempt = z.infer<typeof insertTrainingQuizAttemptSchema>;

export const training_certificate = pgTable('training_certificate', {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  enrollment_id: uuid("enrollment_id").notNull().unique().references(() => training_enrollment.id, { onDelete: "cascade" }),
  user_id: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  course_id: uuid("course_id").notNull().references(() => training_course.id, { onDelete: "cascade" }),
  org_id: uuid("org_id").references(() => organization.id, { onDelete: "set null" }),
  score_pct: integer("score_pct"),
  issued_at: timestamp("issued_at").notNull().defaultNow(),
  certificate_no: varchar("certificate_no"),
});

export const insertTrainingCertificateSchema = createInsertSchema(training_certificate).omit({ id: true, issued_at: true });
export type TrainingCertificate = typeof training_certificate.$inferSelect;
export type InsertTrainingCertificate = z.infer<typeof insertTrainingCertificateSchema>;

export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull().default("direct"),
  name: text("name"),
  createdBy: text("created_by"),
  portalClientId: uuid("portal_client_id"),
  portalClientName: text("portal_client_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({ id: true, createdAt: true, updatedAt: true });
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;

export const chatParticipants = pgTable("chat_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  lastReadAt: timestamp("last_read_at"),
});

export const insertChatParticipantSchema = createInsertSchema(chatParticipants).omit({ id: true, joinedAt: true });
export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// ─── Email Accounts ───────────────────────────────────────────────────────────

export const emailAccounts = pgTable("email_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  emailAddress: text("email_address").notNull(),
  imapHost: text("imap_host").notNull(),
  imapPort: integer("imap_port").notNull().default(993),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull().default(587),
  secure: boolean("secure").notNull().default(true),
  username: text("username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type EmailAccount = typeof emailAccounts.$inferSelect;
export type InsertEmailAccount = Omit<typeof emailAccounts.$inferInsert, "id" | "createdAt" | "updatedAt">;

// ─── SendSeven (Conversations) Integration ────────────────────────────────────
// One SendSeven workspace token per org, so each tenant's inbox is isolated.
// The token is encrypted at rest (see server/v2/utils/encryption.ts).
export const sendsevenIntegrations = pgTable("sendseven_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" })
    .unique(),
  // The SendSeven tenant this org maps to (set when auto-provisioned on onboarding).
  tenantId: text("tenant_id"),
  // Nullable: a row may exist with only the tenant linked, before an API key is
  // minted/entered.
  encryptedToken: text("encrypted_token"),
  baseUrl: text("base_url"), // optional per-org override of CONVERSATIONS_API_URL
  isActive: boolean("is_active").notNull().default(true),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  // ── AI auto-reply webhook (see docs/sendseven-ai-auto-reply-plan.md) ──
  // SendSeven webhook endpoint id (to update/delete) + its signing secret
  // (encrypted at rest). Set when auto-reply is enabled for the org.
  webhookEndpointId: text("webhook_endpoint_id"),
  webhookSecret: text("webhook_secret"),
  autoReplyEnabled: boolean("auto_reply_enabled").notNull().default(false),
  autoReplyMode: text("auto_reply_mode").notNull().default("draft"), // 'draft' | 'send'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SendsevenIntegration = typeof sendsevenIntegrations.$inferSelect;

// Idempotency + audit log for inbound SendSeven webhook deliveries. `eventId` is
// unique so retries of the same delivery are processed at most once.
export const sendsevenWebhookEvents = pgTable("sendseven_webhook_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull().unique(),
  orgId: uuid("org_id").references(() => organization.id, { onDelete: "cascade" }),
  messageId: text("message_id"),
  type: text("type"),
  status: text("status").notNull().default("received"), // received | skipped | replied | failed
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SendsevenWebhookEvent = typeof sendsevenWebhookEvents.$inferSelect;

// Per-org AI bot identity + behaviour, edited on the org-admin "AI Assistant"
// page. The live on/off + mode are on sendseven_integrations (auto_reply_*);
// this holds the persona/instructions used to compose the reply prompt.
export const orgBotConfig = pgTable("org_bot_config", {
  orgId: uuid("org_id").primaryKey().references(() => organization.id, { onDelete: "cascade" }),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  persona: text("persona"),
  preferredResponse: text("preferred_response"),
  greeting: text("greeting"),
  signOff: text("sign_off"),
  language: text("language").notNull().default("en-GB"),
  handoffInstructions: text("handoff_instructions"),
  rules: jsonb("rules"),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type OrgBotConfig = typeof orgBotConfig.$inferSelect;
export const insertOrgBotConfigSchema = createInsertSchema(orgBotConfig).omit({ orgId: true, updatedBy: true, createdAt: true, updatedAt: true });

// Company knowledge the AI is grounded on (one row per entry). RAG-ready.
export const orgKnowledgeBase = pgTable("org_knowledge_base", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  audience: text("audience").notNull().default("general"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type OrgKnowledgeBase = typeof orgKnowledgeBase.$inferSelect;
export const insertOrgKnowledgeBaseSchema = createInsertSchema(orgKnowledgeBase).omit({ id: true, orgId: true, createdBy: true, createdAt: true, updatedAt: true });

// Our per-thread memory for the AI auto-reply, keyed by the SendSeven
// conversation id. See docs/sendseven-ai-auto-reply-plan.md §12–14.
export const sendsevenConversationState = pgTable("sendseven_conversation_state", {
  conversationId: text("conversation_id").primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  contactId: text("contact_id"),
  clientId: uuid("client_id").references(() => clientTable.id, { onDelete: "set null" }),
  intent: text("intent"),
  enquirySlots: jsonb("enquiry_slots"),
  enquiryStatus: text("enquiry_status"), // collecting | confirming | created | null
  enquiryId: text("enquiry_id"),
  // Set when a human takes over; once true the AI stays silent (§8).
  needsHuman: boolean("needs_human").notNull().default(false),
  handledByHumanAt: timestamp("handled_by_human_at"),
  // Per-conversation agent override for the AI opt-in gate:
  //   null       → follow the linked client's aiReplyEnabled (default OFF)
  //   "enabled"  → AI replies here regardless of the client flag
  //   "disabled" → AI never replies here regardless of the client flag
  aiOverride: text("ai_override"),
  context: jsonb("context"), // rolling recent messages / running summary (§13)
  lastAiReplyAt: timestamp("last_ai_reply_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SendsevenConversationState = typeof sendsevenConversationState.$inferSelect;

// Manual link between a SendSeven contact (from the unified inbox) and a client
// in this CRM's client_table. One-to-one per org: a contact maps to one client
// and vice-versa. Kept in its own table so the SendSeven concern stays isolated
// from the core client record and the link is auditable/reversible.
export const sendsevenContactLinks = pgTable(
  "sendseven_contact_links",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    // SendSeven contact UUID (tenant-scoped on their side).
    sendsevenContactId: text("sendseven_contact_id").notNull(),
    clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
    linkedBy: text("linked_by").references(() => user.id, { onDelete: "set null" }),
    linkedAt: timestamp("linked_at").notNull().defaultNow(),
  },
  (t) => ({
    // At most one link per contact per org, and per client per org.
    contactUnique: unique("sendseven_contact_links_org_contact_unique").on(t.orgId, t.sendsevenContactId),
    clientUnique: unique("sendseven_contact_links_org_client_unique").on(t.orgId, t.clientId),
  }),
);

export type SendsevenContactLink = typeof sendsevenContactLinks.$inferSelect;

// ─── Internal Chat (in-system AI chatbot for staff) ──────────────────────────
// A staff-facing chat session — either the org-wide assistant ("assistant")
// or a driven test of the customer-facing enquiry flow ("test_flow", wired up
// in a later phase). One row per session; enquiry* mirrors the shape used by
// sendseven_conversation_state so the same slot-filling machinery can be
// reused once test_flow is implemented.
export const internalChatSession = pgTable("internal_chat_session", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  mode: text("mode").notNull(), // 'assistant' | 'test_flow'
  clientId: uuid("client_id").references(() => clientTable.id, { onDelete: "set null" }),
  intent: text("intent"),
  enquirySlots: jsonb("enquiry_slots"),
  enquiryStatus: text("enquiry_status"),
  enquiryId: text("enquiry_id"),
  // Set when the flow needs a human to step in; the assistant stays silent.
  needsHuman: boolean("needs_human").notNull().default(false),
  context: jsonb("context"),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InternalChatSession = typeof internalChatSession.$inferSelect;
export type InsertInternalChatSession = typeof internalChatSession.$inferInsert;

// One row per message in an internal_chat_session, in send order.
export const internalChatMessage = pgTable("internal_chat_message", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => internalChatSession.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system_note'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idx_internal_chat_message_session_created").on(t.sessionId, t.createdAt),
]);

export type InternalChatMessage = typeof internalChatMessage.$inferSelect;
export type InsertInternalChatMessage = typeof internalChatMessage.$inferInsert;

// ─── AI Embeddings (pgvector) ──────────────────────────────────────────────────
// Vector store for RAG retrieval over org knowledge base entries and quotes.
// One row per (org, sourceType, sourceId); content is the human-readable text
// that was embedded (names, not raw ids) so retrieved rows are directly usable
// in a prompt.
export const aiEmbeddings = pgTable("ai_embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(), // 'knowledge' | 'quote'
  sourceId: text("source_id").notNull(), // kb entry id or quote.id
  content: text("content").notNull(), // human-readable embedded text (names, NOT ids)
  metadata: jsonb("metadata"),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  unique("ai_embeddings_source_uq").on(t.orgId, t.sourceType, t.sourceId),
  index("idx_ai_embeddings_org_source").on(t.orgId, t.sourceType),
]);

export type AiEmbedding = typeof aiEmbeddings.$inferSelect;
export type InsertAiEmbedding = typeof aiEmbeddings.$inferInsert;

// ─── Facebook Integration ─────────────────────────────────────────────────────

export const facebookPages = pgTable("facebook_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  pageId: text("page_id").notNull(),
  pageName: text("page_name").notNull(),
  pageCategory: text("page_category"),
  pageAvatar: text("page_avatar"),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type FacebookPage = typeof facebookPages.$inferSelect;
export type InsertFacebookPage = Omit<typeof facebookPages.$inferInsert, "id" | "createdAt" | "updatedAt">;

// ─── Targets ───────────────────────────────────────────────────────────

export const shopTargetTable = pgTable("shop_target_table", {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  year: integer().notNull(),
  month: integer().notNull(),
  targetAmount: numeric("target_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("shop_target_branch_year_month_unique").on(table.branchId, table.year, table.month)
]);

export const insertShopTargetSchema = createInsertSchema(shopTargetTable).omit({ id: true, createdAt: true, updatedAt: true });
export type ShopTarget = typeof shopTargetTable.$inferSelect;
export type InsertShopTarget = z.infer<typeof insertShopTargetSchema>;

export const agentTargetTable = pgTable("agent_target_table", {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  year: integer().notNull(),
  month: integer().notNull(),
  targetAmount: numeric("target_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("agent_target_branch_user_year_month_unique").on(table.branchId, table.userId, table.year, table.month)
]);

export const insertAgentTargetSchema = createInsertSchema(agentTargetTable).omit({ id: true, createdAt: true, updatedAt: true });
export type AgentTarget = typeof agentTargetTable.$inferSelect;
export type InsertAgentTarget = z.infer<typeof insertAgentTargetSchema>;

export const destinationGuruTable = pgTable("destination_guru", {
  id: uuid().default(sql`gen_random_uuid()`).primaryKey(),
  destination: text().notNull(),
  country: text().notNull(),
  data: jsonb().notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  unique("destination_guru_destination_unique").on(table.destination)
]);

export const insertDestinationGuruSchema = createInsertSchema(destinationGuruTable).omit({ id: true, createdAt: true, updatedAt: true });
export type DestinationGuru = typeof destinationGuruTable.$inferSelect;
export type InsertDestinationGuru = z.infer<typeof insertDestinationGuruSchema>;

export const feedback_type_enum = pgEnum("feedback_type_enum", ["suggestion", "bug", "general"]);
export const feedback_status_enum = pgEnum("feedback_status_enum", ["open", "in_review", "resolved", "closed"]);

export const feedbackTable = pgTable("feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => user.id),
  userName: text("user_name"),
  type: feedback_type_enum("type").notNull().default("general"),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: feedback_status_enum("status").notNull().default("open"),
  adminNotes: text("admin_notes"),
  page: text("page"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFeedbackSchema = createInsertSchema(feedbackTable).omit({ id: true, createdAt: true, updatedAt: true, status: true, adminNotes: true });
export type Feedback = typeof feedbackTable.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;

export const hubAnnouncementTable = pgTable("hub_announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name"),
  category: text("category").notNull().default("latest_news"),
  title: text("title"),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  pinned: boolean("pinned").notNull().default(false),
  postToAll: boolean("post_to_all").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertHubAnnouncementSchema = createInsertSchema(hubAnnouncementTable).omit({ id: true, createdAt: true, updatedAt: true });
export type HubAnnouncement = typeof hubAnnouncementTable.$inferSelect;
export type InsertHubAnnouncement = z.infer<typeof insertHubAnnouncementSchema>;

export const hubAnnouncementLikesTable = pgTable("hub_announcement_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").notNull().references(() => hubAnnouncementTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueLike: unique().on(table.announcementId, table.userId),
}));

export type HubAnnouncementLike = typeof hubAnnouncementLikesTable.$inferSelect;

// Per-user "hide from my wall" for broadcast (postToAll) announcements. The
// announcement still shows on the News page; it's only removed from the
// hiding user's profile timeline.
export const hubAnnouncementHidesTable = pgTable("hub_announcement_hides", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").notNull().references(() => hubAnnouncementTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueHide: unique().on(table.announcementId, table.userId),
}));

export type HubAnnouncementHide = typeof hubAnnouncementHidesTable.$inferSelect;

export const quoteViewsTable = pgTable("quote_views", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quoteId: uuid("quote_id").notNull().references(() => quote.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 45 }),
  deviceType: varchar("device_type", { length: 20 }),
  browser: varchar("browser", { length: 100 }),
  userAgent: text("user_agent"),
  viewerName: varchar("viewer_name", { length: 200 }),
});

export const insertQuoteViewSchema = createInsertSchema(quoteViewsTable).omit({ id: true, viewedAt: true });
export type QuoteView = typeof quoteViewsTable.$inferSelect;
export type InsertQuoteView = z.infer<typeof insertQuoteViewSchema>;

export const quoteCustomerActionsTable = pgTable("quote_customer_actions", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  quoteId: uuid("quote_id").notNull().references(() => quote.id, { onDelete: "cascade" }),
  actionType: varchar("action_type", { length: 30 }).notNull(),
  message: text("message"),
  customerName: varchar("customer_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertQuoteCustomerActionSchema = createInsertSchema(quoteCustomerActionsTable).omit({ id: true, createdAt: true });
export type QuoteCustomerAction = typeof quoteCustomerActionsTable.$inferSelect;
export type InsertQuoteCustomerAction = z.infer<typeof insertQuoteCustomerActionSchema>;

export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: varchar("action").notNull(),
  entityType: varchar("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityTitle: varchar("entity_title"),
  entityData: jsonb("entity_data"),
  reason: text("reason"),
  performedBy: varchar("performed_by").notNull(),
  performedByName: varchar("performed_by_name"),
  clientId: varchar("client_id"),
  clientName: varchar("client_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export const hubPostsTable = pgTable("hub_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  authorName: varchar("author_name", { length: 255 }),
  type: varchar("type", { length: 50 }).notNull().default("deal"),
  content: text("content").notNull(),
  image: text("image"),
  badge: varchar("badge", { length: 100 }),
  destination: varchar("destination", { length: 255 }),
  value: varchar("value", { length: 100 }),
  pinned: boolean("pinned").default(false),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertHubPostSchema = createInsertSchema(hubPostsTable).omit({ id: true, createdAt: true, likes: true });
export type HubPost = typeof hubPostsTable.$inferSelect;
export type InsertHubPost = z.infer<typeof insertHubPostSchema>;

export const hubPostCommentsTable = pgTable("hub_post_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => hubPostsTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  authorName: varchar("author_name", { length: 255 }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type HubPostComment = typeof hubPostCommentsTable.$inferSelect;

export const hubPostLikesTable = pgTable("hub_post_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => hubPostsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniquePostLike: unique().on(table.postId, table.userId),
}));

// Per-user "hide from my wall": a post stays visible to everyone else but is
// filtered out of the timeline for users who have hidden it.
export const hubPostHidesTable = pgTable("hub_post_hides", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => hubPostsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniquePostHide: unique().on(table.postId, table.userId),
}));

export type HubPostHide = typeof hubPostHidesTable.$inferSelect;

export const portalMessages = pgTable("portal_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  sender: varchar("sender", { length: 10 }).notNull(),
  agentId: text("agent_id").references(() => user.id, { onDelete: "set null" }),
  agentName: varchar("agent_name", { length: 255 }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type PortalMessageRow = typeof portalMessages.$inferSelect;

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceName: varchar("device_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Short, single-use codes that ride in an SMS link (e.g. a quote share) and are
// exchanged once for a real portal session — keeps the URL short and avoids a
// long-lived JWT sitting in the message.
export const portalLoginTokens = pgTable("portal_login_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  clientId: uuid("client_id").notNull().references(() => clientTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
export type PortalLoginTokenRow = typeof portalLoginTokens.$inferSelect;

// =====================================================================
// SMS Notifications
// =====================================================================
export const sms_template_category_enum = pgEnum("sms_template_category", [
  "weekly_deals",
  "balance_due",
  "booking_confirmation",
  "tickets_ready",
  "portal_login",
  "quote_link",
  "custom",
]);

export const sms_auto_trigger_enum = pgEnum("sms_auto_trigger", [
  "manual",
  "on_booking_create",
  "on_pin_set",
  "on_tickets_uploaded",
  "days_before_departure",
  "weekly_schedule",
]);

export const smsTemplatesTable = pgTable("sms_templates", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  category: sms_template_category_enum("category").notNull().default("custom"),
  body: text("body").notNull(),
  autoTrigger: sms_auto_trigger_enum("auto_trigger").notNull().default("manual"),
  triggerDaysBefore: integer("trigger_days_before"),
  triggerWeekday: integer("trigger_weekday"),
  triggerHour: integer("trigger_hour"),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idx_sms_templates_org: index("idx_sms_templates_org_id").on(table.orgId),
}));

export const insertSmsTemplateSchema = createInsertSchema(smsTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SmsTemplate = typeof smsTemplatesTable.$inferSelect;
export type InsertSmsTemplate = z.infer<typeof insertSmsTemplateSchema>;

export const sms_message_status_enum = pgEnum("sms_message_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "skipped_optout",
  "skipped_no_phone",
]);

export const smsMessagesTable = pgTable("sms_messages", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  templateId: uuid("template_id").references(() => smsTemplatesTable.id, { onDelete: "set null" }),
  templateName: varchar("template_name", { length: 200 }),
  clientId: uuid("client_id").references(() => clientTable.id, { onDelete: "set null" }),
  clientName: varchar("client_name", { length: 255 }),
  toPhone: varchar("to_phone", { length: 30 }).notNull(),
  body: text("body").notNull(),
  status: sms_message_status_enum("status").notNull().default("queued"),
  providerMessageId: varchar("provider_message_id", { length: 100 }),
  providerError: text("provider_error"),
  costCents: integer("cost_cents"),
  triggeredBy: text("triggered_by").references(() => user.id, { onDelete: "set null" }),
  triggeredByName: varchar("triggered_by_name", { length: 255 }),
  triggerSource: varchar("trigger_source", { length: 50 }),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
});

export const insertSmsMessageSchema = createInsertSchema(smsMessagesTable).omit({
  id: true,
  sentAt: true,
});
export type SmsMessage = typeof smsMessagesTable.$inferSelect;
export type InsertSmsMessage = z.infer<typeof insertSmsMessageSchema>;

// =====================================================================
// HR — hr_records is keyed to user.id. The legacy hr_employees /
// hr_reminders tables were dropped: HR rows are now per real user and
// branch scoping flows through branch_members.
// =====================================================================
export const hrRecordsTable = pgTable("hr_records", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId: uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 32 }).notNull().default("Active"),
  employmentType: varchar("employment_type", { length: 32 }).notNull().default("Full-time"),
  startDate: date("start_date"),
  probationEnd: date("probation_end"),
  managerUserId: text("manager_user_id").references(() => user.id, { onDelete: "set null" }),
  salary: numeric("salary", { precision: 12, scale: 2 }),
  salaryCurrency: varchar("salary_currency", { length: 3 }),
  contractType: varchar("contract_type", { length: 32 }),
  contractEndDate: date("contract_end_date"),
  holidayAllowance: integer("holiday_allowance"),
  taxId: text("tax_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idx_hr_records_org: index("idx_hr_records_org_id").on(table.orgId),
  idx_hr_records_manager: index("idx_hr_records_manager_user_id").on(table.managerUserId),
}));

export const insertHrRecordSchema = createInsertSchema(hrRecordsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type HrRecord = typeof hrRecordsTable.$inferSelect;
export type InsertHrRecord = z.infer<typeof insertHrRecordSchema>;

// Per-employee document, leave and note rows. These replace the JSONB
// arrays previously stored on hr_records (`documents`, `holidays`,
// `notes`) so we can FK to user, filter on category/status, and query
// across employees (e.g. "all certificates expiring in the next 30 days").

export const hrDocumentsTable = pgTable("hr_documents", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  hrRecordId: uuid("hr_record_id").notNull().references(() => hrRecordsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Contract | NDA | Right to Work | Policies | Training | Other
  category: varchar("category", { length: 32 }).notNull().default("Other"),
  // Uploaded | Missing | Expiring Soon
  status: varchar("status", { length: 32 }).notNull().default("Uploaded"),
  s3Key: text("s3_key"),
  mimeType: text("mime_type"),
  size: integer("size"),
  url: text("url"),
  expiresAt: date("expires_at"),
  uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idx_hr_documents_record: index("idx_hr_documents_hr_record_id").on(table.hrRecordId),
  idx_hr_documents_category: index("idx_hr_documents_category").on(table.category),
  idx_hr_documents_expires: index("idx_hr_documents_expires_at").on(table.expiresAt),
}));
export type HrDocument = typeof hrDocumentsTable.$inferSelect;
export type InsertHrDocument = typeof hrDocumentsTable.$inferInsert;

export const hrLeavesTable = pgTable("hr_leaves", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  hrRecordId: uuid("hr_record_id").notNull().references(() => hrRecordsTable.id, { onDelete: "cascade" }),
  // Annual | Sick | Unpaid | Other
  type: varchar("type", { length: 16 }).notNull(),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  // Pending | Approved | Rejected | Cancelled
  status: varchar("status", { length: 16 }).notNull().default("Pending"),
  reason: text("reason"),
  decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idx_hr_leaves_record: index("idx_hr_leaves_hr_record_id").on(table.hrRecordId),
  idx_hr_leaves_status: index("idx_hr_leaves_status").on(table.status),
  idx_hr_leaves_from: index("idx_hr_leaves_from_date").on(table.fromDate),
}));
export type HrLeave = typeof hrLeavesTable.$inferSelect;
export type InsertHrLeave = typeof hrLeavesTable.$inferInsert;

export const hrNotesTable = pgTable("hr_notes", {
  id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  hrRecordId: uuid("hr_record_id").notNull().references(() => hrRecordsTable.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idx_hr_notes_record: index("idx_hr_notes_hr_record_id").on(table.hrRecordId),
  idx_hr_notes_created: index("idx_hr_notes_created_at").on(table.createdAt),
}));
export type HrNote = typeof hrNotesTable.$inferSelect;
export type InsertHrNote = typeof hrNotesTable.$inferInsert;

// ─── Platform-admin audit log (cross-tenant; separate from per-tenant audit_log) ─

export const adminAuditLog = pgTable("admin_audit_log", {
  id:           uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  actorUserId:  text("actor_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  action:       varchar("action", { length: 64 }).notNull(),
  targetOrgId:  uuid("target_org_id").references(() => organization.id, { onDelete: "set null" }),
  targetUserId: text("target_user_id").references(() => user.id, { onDelete: "set null" }),
  metadata:     jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  ipAddress:    varchar("ip_address", { length: 64 }),
  userAgent:    text("user_agent"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  idx_admin_audit_actor:      index("idx_admin_audit_actor").on(table.actorUserId),
  idx_admin_audit_target_org: index("idx_admin_audit_target_org").on(table.targetOrgId),
  idx_admin_audit_created:    index("idx_admin_audit_created").on(table.createdAt),
}));

export type AdminAuditLog       = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

// ─── SMS credit accounting (free monthly allowance + paid overage) ─────────────

export const smsCreditUsage = pgTable("sms_credit_usage", {
  id:             uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId:          uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  periodStart:    date("period_start").notNull(),
  creditsUsed:    integer("credits_used").notNull().default(0),
  creditsGranted: integer("credits_granted").notNull().default(0),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  unique_org_period: unique("sms_credit_usage_org_period_unique").on(table.orgId, table.periodStart),
  idx_org_period:    index("idx_sms_credit_usage_org_period").on(table.orgId, table.periodStart),
}));

export type SmsCreditUsage       = typeof smsCreditUsage.$inferSelect;
export type InsertSmsCreditUsage = typeof smsCreditUsage.$inferInsert;

export const smsCreditCharge = pgTable("sms_credit_charge", {
  id:             uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId:          uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  smsMessageId:   uuid("sms_message_id").references(() => smsMessagesTable.id, { onDelete: "set null" }),
  periodStart:    date("period_start").notNull(),
  credits:        integer("credits").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
  amountCents:    integer("amount_cents").notNull(),
  status:         varchar("status", { length: 16 }).notNull().default("pending"),
  invoicedAt:     timestamp("invoiced_at"),
  paidAt:         timestamp("paid_at"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  idx_org_status: index("idx_sms_credit_charge_org_status").on(table.orgId, table.status),
  idx_org_period: index("idx_sms_credit_charge_period").on(table.orgId, table.periodStart),
}));

export type SmsCreditCharge       = typeof smsCreditCharge.$inferSelect;
export type InsertSmsCreditCharge = typeof smsCreditCharge.$inferInsert;

// ─── AI + SendSeven usage limits, metering & cost accounting ──────────────────
// Per-org limits/metering for LLM token usage and outbound SendSeven messages.
// Monitor-only in Phase 1 (see docs/ai-usage-limits-plan.md) — mirrors the SMS
// credits subsystem above (append-only ledger + fast monthly aggregate).

export const orgUsageLimits = pgTable("org_usage_limits", {
  id:                        uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId:                     uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }).unique(),
  planTier:                  varchar("plan_tier").notNull().default("starter"),
  monthlyAiTokenLimit:       integer("monthly_ai_token_limit"),
  monthlyAiMessageLimit:     integer("monthly_ai_message_limit"),
  monthlySendsevenMsgLimit:  integer("monthly_sendseven_msg_limit"),
  aiLimitsEnabled:           boolean("ai_limits_enabled").notNull().default(true),
  sendsevenLimitsEnabled:    boolean("sendseven_limits_enabled").notNull().default(true),
  enforcementMode:           varchar("enforcement_mode").notNull().default("monitor"),
  warnThresholdPct:          integer("warn_threshold_pct").notNull().default(80),
  createdAt:                 timestamp("created_at").notNull().defaultNow(),
  updatedAt:                 timestamp("updated_at").notNull().defaultNow(),
});

export type OrgUsageLimits       = typeof orgUsageLimits.$inferSelect;
export type InsertOrgUsageLimits = typeof orgUsageLimits.$inferInsert;

export const aiUsageEvent = pgTable("ai_usage_event", {
  id:               uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId:            uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  feature:          varchar("feature").notNull(),
  site:             varchar("site"),
  model:            varchar("model").notNull(),
  promptTokens:     integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  cachedTokens:     integer("cached_tokens").notNull().default(0),
  totalTokens:      integer("total_tokens").notNull().default(0),
  costMicros:       bigint("cost_micros", { mode: "number" }).notNull().default(0),
  conversationId:   varchar("conversation_id"),
  userId:           text("user_id"),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  idx_org_created: index("idx_ai_usage_event_org_created").on(table.orgId, table.createdAt),
}));

export type AiUsageEvent       = typeof aiUsageEvent.$inferSelect;
export type InsertAiUsageEvent = typeof aiUsageEvent.$inferInsert;

export const aiUsageMonthly = pgTable("ai_usage_monthly", {
  id:               uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId:            uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  periodStart:      date("period_start").notNull(),
  promptTokens:     bigint("prompt_tokens", { mode: "number" }).notNull().default(0),
  completionTokens: bigint("completion_tokens", { mode: "number" }).notNull().default(0),
  totalTokens:      bigint("total_tokens", { mode: "number" }).notNull().default(0),
  messageCount:     integer("message_count").notNull().default(0),
  costMicros:       bigint("cost_micros", { mode: "number" }).notNull().default(0),
}, (table) => ({
  unique_org_period: unique("ai_usage_monthly_org_period_unique").on(table.orgId, table.periodStart),
  idx_org_period:    index("idx_ai_usage_monthly_org_period").on(table.orgId, table.periodStart),
}));

export type AiUsageMonthly       = typeof aiUsageMonthly.$inferSelect;
export type InsertAiUsageMonthly = typeof aiUsageMonthly.$inferInsert;

export const sendsevenMessageUsage = pgTable("sendseven_message_usage", {
  id:          uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  orgId:       uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  sentCount:   integer("sent_count").notNull().default(0),
  aiSentCount: integer("ai_sent_count").notNull().default(0),
}, (table) => ({
  unique_org_period: unique("sendseven_message_usage_org_period_unique").on(table.orgId, table.periodStart),
  idx_org_period:    index("idx_sendseven_message_usage_org_period").on(table.orgId, table.periodStart),
}));

export type SendsevenMessageUsage       = typeof sendsevenMessageUsage.$inferSelect;
export type InsertSendsevenMessageUsage = typeof sendsevenMessageUsage.$inferInsert;

export const modelPricing = pgTable("model_pricing", {
  id:                        uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  model:                     varchar("model").notNull(),
  inputMicrosPerMtok:        bigint("input_micros_per_mtok", { mode: "number" }).notNull(),
  cachedInputMicrosPerMtok:  bigint("cached_input_micros_per_mtok", { mode: "number" }).notNull().default(0),
  outputMicrosPerMtok:       bigint("output_micros_per_mtok", { mode: "number" }).notNull().default(0),
  effectiveFrom:             timestamp("effective_from").notNull().defaultNow(),
}, (table) => ({
  unique_model_effective: unique("model_pricing_model_effective_unique").on(table.model, table.effectiveFrom),
}));

export type ModelPricing       = typeof modelPricing.$inferSelect;
export type InsertModelPricing = typeof modelPricing.$inferInsert;

// ─── Multi-role per user (org-level roles; platform_admin is NOT here) ─────────

export const userOrgRoles = pgTable("user_org_roles", {
  id:        uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
  userId:    text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  orgId:     uuid("org_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  role:      varchar("role", { length: 32 }).notNull(),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
  grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
}, (table) => ({
  unique_user_org_role: unique("user_org_roles_user_org_role_unique").on(table.userId, table.orgId, table.role),
  idx_user:             index("idx_user_org_roles_user").on(table.userId, table.orgId),
  idx_org:              index("idx_user_org_roles_org").on(table.orgId),
}));

export type UserOrgRole       = typeof userOrgRoles.$inferSelect;
export type InsertUserOrgRole = typeof userOrgRoles.$inferInsert;
