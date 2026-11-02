/**
 * The ONLY module that connects to the test database. Reuses the integration-test
 * factories (server/v2/test/factories.ts) for the rows it creates.
 */
import "./test-db-env";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "../../server/v2/config/database";
import {
  accomodation_list,
  accomodation_type,
  airport,
  booking,
  clientTable,
  quote,
  transaction,
  board_basis,
  branchMembers,
  branches,
  country,
  destination,
  org_tour_operator,
  organization,
  package_type,
  resorts,
  tasks,
  tour_operator,
  user,
} from "../../shared/schema";
import {
  makeBranch,
  makeBranchMember,
  makeBooking,
  makeClient,
  makeOrg,
  makeQuote,
  makeTransaction,
  makeUser,
  truncateAll,
} from "../../server/v2/test/factories";
import { buildServerEnv } from "./env";
import { assertTestDatabaseName } from "./safety-guard";

const root = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(import.meta.url);

export const TEST_PASSWORD = "E2e-Passw0rd!";
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

/** Short unique suffix: safe across workers and repeated runs against the same database. */
export function unique(prefix = "t"): string {
  return `${prefix}${Date.now().toString(36)}${randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

export function uniqueEmail(prefix = "user"): string {
  return `${unique(prefix)}@e2e.test`;
}

/** A random private address, used as X-Forwarded-For so each test has its own rate-limit bucket. */
export function randomIp(): string {
  const b = randomBytes(3);
  return `10.${b[0]}.${b[1]}.${(b[2] % 253) + 1}`;
}

/* ------------------------------ global reset ------------------------------ */

/** Reference data the deal forms need. Global (not per agency); seeded once by global setup. */
export const REF = {
  packageTypes: ["Package Holiday", "Hot Tub Break", "Cruise Package", "Flight Only"],
  boardBasis: ["All Inclusive", "Half Board", "Bed and Breakfast"],
  country: { name: "United Kingdom", code: "GB" },
  spain: { name: "Spain", code: "ES" },
  destinations: ["Majorca", "Tenerife"],
  resort: "Alcudia",
  accommodation: "Hotel Playa Azul",
  airport: { name: "Newcastle International", code: "NCL" },
  airport2: { name: "Palma de Mallorca", code: "PMI" },
  /** Linked to every deals agency by default. */
  operator: "E2E Sun Holidays",
  /** In the catalogue but never linked to an agency: quotes naming it must be refused. */
  unlinkedOperator: "E2E Unlinked Tours",
} as const;

async function firstId<T extends { id: string }>(rows: T[]): Promise<string | undefined> {
  return rows[0]?.id;
}

/** Idempotent: inserts each row only if its name is missing. Must run after resetDatabase (which empties tour operators). */
export async function seedReferenceData(): Promise<void> {
  for (const name of REF.packageTypes) {
    if (!(await firstId(await db.select().from(package_type).where(eq(package_type.name, name))))) {
      await db.insert(package_type).values({ name });
    }
  }
  for (const type of REF.boardBasis) {
    if (!(await firstId(await db.select().from(board_basis).where(eq(board_basis.type, type))))) {
      await db.insert(board_basis).values({ type });
    }
  }
  const ensureCountry = async (c: { name: string; code: string }) => {
    const found = await firstId(await db.select().from(country).where(eq(country.country_name, c.name)));
    if (found) return found;
    const [row] = await db.insert(country).values({ country_name: c.name, country_code: c.code }).returning();
    return row.id;
  };
  const ukId = await ensureCountry(REF.country);
  const spainId = await ensureCountry(REF.spain);
  let majorcaId: string | undefined;
  for (const name of REF.destinations) {
    let id = await firstId(await db.select().from(destination).where(eq(destination.name, name)));
    if (!id) [{ id }] = await db.insert(destination).values({ name, country_id: spainId }).returning();
    if (name === "Majorca") majorcaId = id;
  }
  let resortId = await firstId(await db.select().from(resorts).where(eq(resorts.name, REF.resort)));
  if (!resortId) [{ id: resortId }] = await db.insert(resorts).values({ name: REF.resort, destination_id: majorcaId }).returning();
  if (!(await firstId(await db.select().from(accomodation_type)))) await db.insert(accomodation_type).values({ type: "Hotel" });
  if (!(await firstId(await db.select().from(accomodation_list).where(eq(accomodation_list.name, REF.accommodation))))) {
    await db.insert(accomodation_list).values({ name: REF.accommodation, resorts_id: resortId });
  }
  if (!(await firstId(await db.select().from(airport).where(eq(airport.airport_code, REF.airport.code))))) {
    await db.insert(airport).values({ airport_name: REF.airport.name, airport_code: REF.airport.code, country_id: ukId });
  }
  if (!(await firstId(await db.select().from(airport).where(eq(airport.airport_code, REF.airport2.code))))) {
    await db.insert(airport).values({ airport_name: REF.airport2.name, airport_code: REF.airport2.code, country_id: spainId });
  }
  for (const name of [REF.operator, REF.unlinkedOperator]) {
    if (!(await firstId(await db.select().from(tour_operator).where(eq(tour_operator.name, name))))) {
      await db.insert(tour_operator).values({ name, code: name.slice(4, 8).toUpperCase() });
    }
  }
}

export interface ReferenceIds {
  packageType: string;
  hotTub: string;
  boardBasis: string;
  boardBasis2: string;
  destination: string;
  resort: string;
  accommodation: string;
  airport: string;
  airport2: string;
  operator: string;
  unlinkedOperator: string;
}

/** Looks the seeded reference rows up by name. */
export async function getReferenceIds(): Promise<ReferenceIds> {
  const need = async (rows: { id: string }[], what: string) => {
    if (!rows[0]) throw new Error(`Reference data "${what}" is missing; was seedReferenceData run?`);
    return rows[0].id;
  };
  return {
    packageType: await need(await db.select().from(package_type).where(eq(package_type.name, "Package Holiday")), "Package Holiday"),
    hotTub: await need(await db.select().from(package_type).where(eq(package_type.name, "Hot Tub Break")), "Hot Tub Break"),
    boardBasis: await need(await db.select().from(board_basis).where(eq(board_basis.type, REF.boardBasis[0])), REF.boardBasis[0]),
    boardBasis2: await need(await db.select().from(board_basis).where(eq(board_basis.type, REF.boardBasis[1])), REF.boardBasis[1]),
    destination: await need(await db.select().from(destination).where(eq(destination.name, "Majorca")), "Majorca"),
    resort: await need(await db.select().from(resorts).where(eq(resorts.name, REF.resort)), REF.resort),
    accommodation: await need(await db.select().from(accomodation_list).where(eq(accomodation_list.name, REF.accommodation)), REF.accommodation),
    airport: await need(await db.select().from(airport).where(eq(airport.airport_code, REF.airport.code)), "NCL"),
    airport2: await need(await db.select().from(airport).where(eq(airport.airport_code, REF.airport2.code)), "PMI"),
    operator: await need(await db.select().from(tour_operator).where(eq(tour_operator.name, REF.operator)), REF.operator),
    unlinkedOperator: await need(await db.select().from(tour_operator).where(eq(tour_operator.name, REF.unlinkedOperator)), REF.unlinkedOperator),
  };
}

/** Links a catalogue operator to an agency (what the Tour Operators settings page does). */
export async function linkTourOperator(orgId: string, operatorId: string, commissionPercentage = "10.00"): Promise<void> {
  await db.insert(org_tour_operator).values({ org_id: orgId, tour_operator_id: operatorId, commission_percentage: commissionPercentage }).onConflictDoNothing();
}

/** The schema has a pgvector column; drizzle-kit push does not create extensions, so do it first. */
export async function ensureExtensions(): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
}

/** Wipe tenant data and sessions. Run once, from global setup. */
export async function resetDatabase(): Promise<void> {
  const current = await db.execute(sql`select current_database() as name`);
  assertTestDatabaseName((current.rows[0] as { name?: string } | undefined)?.name);
  await truncateAll();
  await db.execute(sql`TRUNCATE TABLE "sessions"`);
}

/** Runs scripts/seed-plans.ts against the test database (same plan rows as production). */
export function seedPlans(): void {
  execFileSync(process.execPath, [require.resolve("tsx/cli"), "scripts/seed-plans.ts"], {
    cwd: root,
    env: buildServerEnv(),
    stdio: "inherit",
  });
}

/* --------------------------------- seeding -------------------------------- */

export interface SeededAgency {
  orgId: string;
  branchId: string;
  adminId: string;
  adminEmail: string;
  orgName: string;
}

export interface SeedAgencyOptions {
  seatLimit?: number | null;
  plan?: string;
  branchName?: string;
}

/** An established agency (no onboarding key, so it counts as complete) with a verified owner. */
export async function seedAgency(opts: SeedAgencyOptions = {}): Promise<SeededAgency> {
  const tag = unique("ag");
  const orgName = `Agency ${tag}`;
  const org = await makeOrg({
    name: orgName,
    slug: tag,
    plan: opts.plan ?? "starter",
    seatLimit: opts.seatLimit === undefined ? 10 : opts.seatLimit,
    settings: {},
  });
  const branch = await makeBranch(org.id, {
    name: opts.branchName ?? `Shop ${tag}`,
    branchType: "shop",
    isDefault: true,
    email: `shop-${tag}@e2e.test`,
  });
  const admin = await seedMember({ orgId: org.id, branchId: branch.id, orgRole: "org_admin", firstName: "Olive", lastName: "Owner" });
  return { orgId: org.id, branchId: branch.id, adminId: admin.id, adminEmail: admin.email, orgName };
}

/** Another shop in the same agency (no plan limit applies to seeded rows). */
export async function makeSecondBranch(orgId: string) {
  return makeBranch(orgId, { name: `Second shop ${unique("b")}`, branchType: "shop", email: `second-${unique("b")}@e2e.test` });
}

export interface SeedMemberOptions {
  orgId: string;
  branchId: string;
  orgRole: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** An accepted, verified, active member with a password and a branch membership. */
export async function seedMember(opts: SeedMemberOptions) {
  const firstName = opts.firstName ?? "Test";
  const lastName = opts.lastName ?? unique("Ln");
  const created = await makeUser({
    name: `${firstName} ${lastName}`,
    email: opts.email ?? uniqueEmail(opts.orgRole),
    firstName,
    lastName,
    phoneNumber: "07700900123",
    role: "Agent",
    orgId: opts.orgId,
    orgRole: opts.orgRole,
    password: PASSWORD_HASH,
    emailVerified: true,
  });
  await makeBranchMember({ orgId: opts.orgId, branchId: opts.branchId, userId: created.id, orgRole: opts.orgRole, isActive: true });
  return created;
}

/**
 * An agent or branch manager with NO shop: an active user of the organisation with no branch membership (a newly
 * created agent before branch assignment). They can sign in; every deal scope must give them nothing.
 */
export async function seedBranchlessMember(opts: { orgId: string; orgRole: "agent" | "branch_manager"; email?: string }) {
  return makeUser({
    name: `No Shop ${unique("n")}`,
    email: opts.email ?? uniqueEmail(`noshop-${opts.orgRole}`),
    firstName: "No",
    lastName: "Shop",
    phoneNumber: "07700900123",
    role: "Agent",
    orgId: opts.orgId,
    orgRole: opts.orgRole,
    password: PASSWORD_HASH,
    emailVerified: true,
  });
}

/** A homeworker with their OWN homeworker branch (a separate partition from the shops), as the app creates them. */
export async function seedHomeworker(orgId: string) {
  const branch = await makeBranch(orgId, { name: `Homeworkers ${unique("h")}`, branchType: "homeworker", email: `hw-${unique("h")}@e2e.test` });
  const member = await seedMember({ orgId, branchId: branch.id, orgRole: "homeworker", firstName: "Hana", lastName: "Homeworker" });
  await db.update(branches).set({ ownerUserId: member.id }).where(eq(branches.id, branch.id));
  return { branchId: branch.id, id: member.id, email: member.email };
}

/** Open work for a member: an active client and an unfinished task. Both count in the removal workload. */
export async function seedOpenWork(input: { userId: string; orgId: string; branchId: string }): Promise<void> {
  await makeClient({ firstName: "Carla", surename: unique("Client"), createdBy: input.userId, orgId: input.orgId, branchId: input.branchId });
  await db.insert(tasks).values({
    id: randomUUID(),
    userId: input.userId,
    orgId: input.orgId,
    branchId: input.branchId,
    title: "Call the client back",
    completed: false,
  });
}

/** A deal owned by `userId` with one quote on it; returns the quote id (in scope for that user and their org). */
export async function seedQuote(input: { userId: string; orgId: string; branchId: string }): Promise<string> {
  const txn = await makeTransaction({ user_id: input.userId, org_id: input.orgId, branch_id: input.branchId, status: "on_quote" });
  const q = await makeQuote({ transaction_id: txn.id });
  return q.id;
}

/** Moves an agency to another plan row (e.g. growth for multi-shop runs). */
export async function setOrgPlan(orgId: string, plan: string, seatLimit: number | null): Promise<void> {
  await db.update(organization).set({ plan, seatLimit }).where(eq(organization.id, orgId));
}

/* ------------------------------- reading rows ------------------------------ */

export async function findUser(email: string) {
  const [row] = await db.select().from(user).where(eq(user.email, email.toLowerCase()));
  return row;
}

export async function requireUser(email: string) {
  const row = await findUser(email);
  if (!row) throw new Error(`No user with email ${email} in the test database`);
  return row;
}

/** The verification token the signup email would have carried. */
export async function readVerificationToken(email: string): Promise<string> {
  const row = await requireUser(email);
  if (!row.verificationToken) throw new Error(`${email} has no verification token`);
  return row.verificationToken;
}

/** The invite token the invitation email would have carried. */
export async function readInviteToken(email: string): Promise<string> {
  const row = await requireUser(email);
  if (!row.inviteToken) throw new Error(`${email} has no invite token`);
  return row.inviteToken;
}

/**
 * The reset token the forgot-password email would have carried. The server replies first and
 * issues the token in the background, so poll briefly instead of reading once.
 */
export async function readResetToken(email: string, timeoutMs = 10_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const row = await requireUser(email);
    if (row.resetToken) return row.resetToken;
    if (Date.now() >= deadline) throw new Error(`${email} has no reset token`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function expireResetToken(email: string): Promise<void> {
  await db.update(user).set({ resetTokenExpiry: new Date(Date.now() - 60_000) }).where(eq(user.email, email.toLowerCase()));
}

/** A verified platform admin with a password (not tied to any agency). */
export async function seedPlatformAdmin() {
  return makeUser({
    name: "Pat Platform",
    email: uniqueEmail("platform"),
    firstName: "Pat",
    lastName: "Platform",
    phoneNumber: "07700900123",
    role: "platform_admin",
    password: PASSWORD_HASH,
    emailVerified: true,
  });
}

export async function expireVerificationToken(email: string): Promise<void> {
  await db.update(user).set({ verificationTokenExpiry: new Date(Date.now() - 60_000) }).where(eq(user.email, email.toLowerCase()));
}

export async function expireInviteToken(email: string): Promise<void> {
  await db.update(user).set({ inviteTokenExpiry: new Date(Date.now() - 60_000) }).where(eq(user.email, email.toLowerCase()));
}

/** Pretend the last verification email went out two minutes ago, so the 60 second resend cooldown is over. */
export async function backdateVerificationSend(email: string): Promise<void> {
  const twoMinutesAgo = Date.now() - 2 * 60_000;
  await db
    .update(user)
    .set({ verificationTokenExpiry: new Date(twoMinutesAgo + 24 * 60 * 60 * 1000) })
    .where(eq(user.email, email.toLowerCase()));
}

export async function countSessionsFor(userId: string): Promise<number> {
  const result = await db.execute(sql`SELECT count(*)::int AS n FROM "sessions" WHERE sess::text LIKE ${"%" + userId + "%"}`);
  return Number((result.rows[0] as { n: number }).n);
}

export async function listMemberships(userId: string) {
  return db.select().from(branchMembers).where(eq(branchMembers.userId, userId));
}

export async function listOrgBranches(orgId: string) {
  return db.select().from(branches).where(eq(branches.organizationId, orgId));
}

export async function ownerOfOpenWork(userId: string): Promise<{ clients: number; tasks: number }> {
  const c = await db.execute(sql`SELECT count(*)::int AS n FROM client_table WHERE created_by = ${userId}`);
  const t = await db.execute(sql`SELECT count(*)::int AS n FROM tasks WHERE user_id = ${userId}`);
  return { clients: Number((c.rows[0] as { n: number }).n), tasks: Number((t.rows[0] as { n: number }).n) };
}

export async function findOrgByOwnerEmail(email: string) {
  const owner = await findUser(email);
  if (!owner?.orgId) return undefined;
  const [org] = await db.select().from(organization).where(eq(organization.id, owner.orgId));
  return org;
}

export async function closeDb(): Promise<void> {
  const { pool } = await import("../../server/v2/config/database");
  await pool.end();
}

/* ------------------------------ deals helpers ------------------------------ */

/** Raw read-only SQL for assertions (test database only; this module is pinned to it). */
export async function queryRows<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const { pool } = await import("../../server/v2/config/database");
  // DATE columns come back as plain "yyyy-MM-dd" strings, not time-zone-shifted Date objects.
  const pg = (await import("pg")).default;
  const types = {
    getTypeParser: (oid: number, format?: "text" | "binary") =>
      oid === 1082 ? (value: string) => value : pg.types.getTypeParser(oid, format as "text"),
  };
  const result = await pool.query({ text: query, values: params, types });
  return result.rows as T[];
}

export interface DealsAgency extends SeededAgency {
  agentId: string;
  agentEmail: string;
  ref: ReferenceIds;
}

/**
 * An agency ready for deal work: an org admin, one agent in the same shop, and the seeded tour
 * operator linked to the org (E2E Sun Holidays only; REF.unlinkedOperator is deliberately left out).
 */
export async function seedDealsAgency(): Promise<DealsAgency> {
  const agency = await seedAgency();
  const agent = await seedMember({ orgId: agency.orgId, branchId: agency.branchId, orgRole: "agent", firstName: "Ann", lastName: "Agent" });
  const ref = await getReferenceIds();
  await linkTourOperator(agency.orgId, ref.operator);
  return { ...agency, agentId: agent.id, agentEmail: agent.email, ref };
}

export async function dbClient(id: string) {
  const [row] = await db.select().from(clientTable).where(eq(clientTable.id, id));
  return row;
}

export async function dbQuote(id: string) {
  const [row] = await db.select().from(quote).where(eq(quote.id, id));
  return row;
}

export async function dbTransaction(id: string) {
  const [row] = await db.select().from(transaction).where(eq(transaction.id, id));
  return row;
}

export async function dbBookingFor(transactionId: string) {
  const [row] = await db.select().from(booking).where(eq(booking.transaction_id, transactionId));
  return row;
}

/** An open task attached to a quote (what the quote's Tasks card shows). */
export async function seedQuoteTask(input: { userId: string; orgId: string; branchId: string; quoteId: string; title?: string }): Promise<string> {
  const id = randomUUID();
  await db.insert(tasks).values({
    id,
    entityType: "quote",
    entityId: input.quoteId,
    userId: input.userId,
    title: input.title ?? "Chase the customer",
    completed: false,
    orgId: input.orgId,
    branchId: input.branchId,
  });
  return id;
}

export async function taskCompleted(id: string): Promise<boolean> {
  const [row] = await db.select({ completed: tasks.completed }).from(tasks).where(eq(tasks.id, id));
  return row?.completed === true;
}

/** A booked deal whose HAYS Ref is in an old, non-HAY- format (what existing agencies still have). */
export async function seedLegacyBooking(input: {
  userId: string;
  orgId: string;
  branchId: string;
  clientId: string;
  haysRef?: string;
  supplierRef?: string;
  operatorId?: string;
  holidayTypeId?: string;
}) {
  const txn = await makeTransaction({
    user_id: input.userId,
    org_id: input.orgId,
    branch_id: input.branchId,
    client_id: input.clientId,
    status: "on_booking",
  });
  const b = await makeBooking({
    transaction_id: txn.id,
    hays_ref: input.haysRef ?? "HAYS-1234",
    supplier_ref: input.supplierRef ?? "OLD-SUP-1",
    travel_date: "2027-09-01",
    title: "Legacy booking",
    sales_price: "1500.00",
    adult: 2,
    main_tour_operator_id: input.operatorId,
    holiday_type_id: input.holidayTypeId,
  });
  return { transactionId: txn.id, bookingId: b.id };
}

/** Tables that would hold a per-agency messaging login or token. The suite must never put a row in any of them. */
export const MESSAGING_CONFIG_TABLES = ["sendseven_integrations", "org_whatsapp_settings", "email_accounts", "facebook_pages"] as const;

export async function countMessagingConfigRows(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of MESSAGING_CONFIG_TABLES) {
    const [row] = await queryRows<{ n: number }>(`select count(*)::int as n from ${table}`);
    out[table] = row.n;
  }
  return out;
}

/** Throws if any per-agency SendSeven / WhatsApp / email-account settings exist in the test database. */
export async function assertNoMessagingConfig(): Promise<void> {
  const counts = await countMessagingConfigRows();
  const bad = Object.entries(counts).filter(([, n]) => n > 0);
  if (bad.length > 0) {
    throw new Error(`Messaging settings found in the test database (${bad.map(([t, n]) => `${t}: ${n}`).join(", ")}). Seeds must not add them.`);
  }
}
