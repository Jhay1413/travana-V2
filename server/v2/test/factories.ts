import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../config/database";
import {
  organization, branches, user, transaction,
  package_type, board_basis, booking, booking_accomodation,
  quote, passengers, clientTable, booking_upsell,
} from "@shared/schema";

type OrgInsert = typeof organization.$inferInsert;
type BranchInsert = typeof branches.$inferInsert;
type UserInsert = typeof user.$inferInsert;
type TxnInsert = typeof transaction.$inferInsert;
type PackageTypeInsert = typeof package_type.$inferInsert;
type BoardBasisInsert = typeof board_basis.$inferInsert;
type BookingInsert = typeof booking.$inferInsert;
type BookingAccomInsert = typeof booking_accomodation.$inferInsert;
type QuoteInsert = typeof quote.$inferInsert;
type PassengerInsert = typeof passengers.$inferInsert;
type ClientInsert = typeof clientTable.$inferInsert;
type UpsellInsert = typeof booking_upsell.$inferInsert;

// Wipe the tenant graph. CASCADE clears everything referencing user/organization
// (branches, transaction, booking, …) so each test starts from empty.
export async function truncateAll(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE "user", "organization" RESTART IDENTITY CASCADE`);
}

export async function makeOrg(overrides: Partial<OrgInsert> = {}) {
  const [row] = await db
    .insert(organization)
    .values({ name: "Test Org", slug: `org-${randomUUID().slice(0, 8)}`, ...overrides })
    .returning();
  return row;
}

export async function makeBranch(organizationId: string, overrides: Partial<BranchInsert> = {}) {
  const [row] = await db
    .insert(branches)
    .values({ organizationId, name: "Test Branch", ...overrides })
    .returning();
  return row;
}

export async function makeUser(overrides: Partial<UserInsert> = {}) {
  const id = overrides.id ?? randomUUID();
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: "Test User",
      email: `u-${id}@test.local`,
      role: "agent",
      firstName: "Test",
      lastName: "User",
      phoneNumber: "0000",
      ...overrides,
    })
    .returning();
  return row;
}

export async function makeTransaction(overrides: Partial<TxnInsert> & { user_id: string }) {
  const [row] = await db.insert(transaction).values({ ...overrides }).returning();
  return row;
}

export async function makePackageType(overrides: Partial<PackageTypeInsert> = {}) {
  const [row] = await db.insert(package_type).values({ name: "Package", ...overrides }).returning();
  return row;
}

export async function makeBoardBasis(overrides: Partial<BoardBasisInsert> = {}) {
  const [row] = await db.insert(board_basis).values({ type: "All Inclusive", ...overrides }).returning();
  return row;
}

// Seeds a booking. holiday_type_id (NOT NULL FK → package_type) is auto-created
// when not supplied; the other NOT NULL columns get sensible defaults.
export async function makeBooking(
  opts: Partial<BookingInsert> & { transaction_id: string },
) {
  const holidayTypeId = opts.holiday_type_id ?? (await makePackageType()).id;
  const [row] = await db
    .insert(booking)
    .values({
      hays_ref: "HAYS-1",
      supplier_ref: "SUP-1",
      travel_date: "2026-12-01",
      ...opts,
      holiday_type_id: holidayTypeId,
    })
    .returning();
  return row;
}

export async function makeBookingAccommodation(
  opts: Partial<BookingAccomInsert> & { booking_id: string },
) {
  const [row] = await db.insert(booking_accomodation).values({ ...opts }).returning();
  return row;
}

// Seeds a quote. holiday_type_id (NOT NULL FK → package_type) is auto-created when
// not supplied; travel_date and quote_type (both NOT NULL, no default) get defaults.
export async function makeQuote(opts: Partial<QuoteInsert> & { transaction_id: string }) {
  const holidayTypeId = opts.holiday_type_id ?? (await makePackageType()).id;
  const [row] = await db
    .insert(quote)
    .values({
      travel_date: "2026-12-01",
      quote_type: "package",
      ...opts,
      holiday_type_id: holidayTypeId,
    })
    .returning();
  return row;
}

export async function makePassenger(opts: Partial<PassengerInsert> = {}) {
  const [row] = await db.insert(passengers).values({ type: "child", age: 0, ...opts }).returning();
  return row;
}

export async function makeClient(opts: Partial<ClientInsert> = {}) {
  const [row] = await db
    .insert(clientTable)
    .values({ firstName: "Client", surename: "Test", phoneNumber: "0000", ...opts })
    .returning();
  return row;
}

export async function makeBookingUpsell(opts: Partial<UpsellInsert> & { booking_id: string }) {
  const [row] = await db.insert(booking_upsell).values({ upsell_type: "OTHER", ...opts }).returning();
  return row;
}
