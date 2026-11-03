/**
 * Helpers for the tickets, tasks, dashboard and passengers specs. API calls here are SETUP (and access checks);
 * the behaviour under test is driven through the screens.
 */
import type { APIRequestContext, APIResponse, Page } from "@playwright/test";
import { expect } from "./fixtures";
import { dataOf, signIn } from "./deals";
import { bookedDeal, type BoardWorld } from "./pipeline";
import { makeSecondBranch, queryRows, seedBranchlessMember, seedDealsAgency, seedHomeworker, seedMember, type DealsAgency } from "./seed";

/* --------------------------------- tickets --------------------------------- */

export interface TicketRow {
  id: string;
  subject: string;
  status: string;
  priority: string;
  type: string;
  userId: string;
  assignedTo: string | null;
  clientId: string | null;
  transactionId: string | null;
  dueDate: string | null;
  createdAt: string;
  resolvedAt: string | null;
  branchId: string | null;
  orgId: string | null;
  description: string | null;
}

/**
 * These columns are timestamp WITHOUT time zone and hold a UTC wall clock. pg would parse them in this machine's own
 * zone, so they are read as text (`col::text`) and tagged UTC here, which gives the same instant in every zone.
 */
function utcWallClock(value: string): Date;
function utcWallClock(value: string | null): Date | null;
function utcWallClock(value: string | null): Date | null {
  return value === null ? null : new Date(`${value.replace(" ", "T")}Z`);
}

let ticketCounter = 0;
export function ticketSubject(label = "Ticket"): string {
  return `${label} ${Date.now().toString(36)}${(ticketCounter++).toString(36)}`;
}

/** Creates a ticket as whoever the request context is signed in as. */
export async function apiCreateTicket(request: APIRequestContext, body: Record<string, unknown>): Promise<TicketRow> {
  // The body schema wants a userId; the service replaces it with the signed-in user whatever it says.
  const me = (await (await request.get("/api/auth/user")).json()) as { id: string };
  const res = await request.post("/api/v2/tickets", {
    data: { type: "Sales", status: "Open", priority: "Medium", subject: ticketSubject(), userId: me.id, ...body },
  });
  return dataOf<TicketRow>(res, 201);
}

export async function dbTicket(id: string) {
  const [row] = await queryRows<{
    id: string;
    status: string;
    priority: string;
    subject: string;
    assigned_to: string | null;
    user_id: string;
    due_date: string | null;
    resolved_at: string | null;
    branch_id: string | null;
    org_id: string | null;
    client_id: string | null;
    transaction_id: string | null;
    created_at: string;
  }>(`select id, status, priority, subject, assigned_to, user_id, due_date::text as due_date, resolved_at::text as resolved_at, branch_id, org_id, client_id, transaction_id, created_at::text as created_at from tickets where id = $1`, [id]);
  // A missing row stays undefined (typed as a row, as before) so "expect(...).toBeUndefined()" keeps working.
  const out = row && { ...row, resolved_at: utcWallClock(row.resolved_at), created_at: utcWallClock(row.created_at) };
  return out as NonNullable<typeof out>;
}

export async function dbReplies(ticketId: string) {
  const rows = await queryRows<{ id: string; content: string; user_id: string; parent_reply_id: string | null; created_at: string }>(
    `select id, content, user_id, parent_reply_id, created_at::text as created_at from ticket_replies where ticket_id = $1 order by created_at, id`,
    [ticketId],
  );
  return rows.map((row) => ({ ...row, created_at: utcWallClock(row.created_at) }));
}

/** The tickets a signed-in request context can list with scope "all" (404/403 shown as the status). */
export async function listTicketIds(request: APIRequestContext, scope: "mine" | "raised" | "all" = "mine"): Promise<{ status: number; ids: string[] }> {
  const res = await request.get(`/api/v2/tickets?scope=${scope}`);
  if (res.status() !== 200) return { status: res.status(), ids: [] };
  const body = (await res.json()) as { data: TicketRow[] };
  return { status: 200, ids: body.data.map((t) => t.id) };
}

/** Opens /tickets and waits for the list request to answer, so "this ticket is absent" can only mean the server did not send it. */
export async function openQueue(page: Page, opts: { view?: "list" | "board" } = {}): Promise<void> {
  const answered = page.waitForResponse((r) => /\/api\/v2\/tickets(\?|$)/.test(r.url()) && r.request().method() === "GET");
  await Promise.all([answered, page.goto("/tickets")]);
  expect((await answered).status()).toBe(200);
  await expect(page.getByTestId("tickets-title")).toBeVisible();
  await expect(page.getByTestId("section-tickets")).toBeVisible();
  if (opts.view === "list") {
    await page.getByTestId("ticket-view-list").click();
    await expect(page.getByTestId("ticket-list")).toBeVisible();
  }
}

/* ---------------------------------- roles ---------------------------------- */

export interface Person {
  id: string;
  email: string;
}

export interface WorkWorld {
  agency: DealsAgency;
  /** Shop 1: agent (the default sign-in), second agent, branch manager. */
  agent: Person;
  agentB: Person;
  manager1: Person;
  /** Shop 2. */
  branch2Id: string;
  agent2: Person;
  manager2: Person;
  /** Same agency, other roles. */
  admin: Person;
  smm: Person;
  referral: Person;
  noShop: Person;
  homeworker: Person & { branchId: string };
  /** A second, unrelated agency. */
  foreign: { agent: Person; admin: Person; branchId: string; orgId: string };
}

/** One agency with two shops and every role the access matrix needs, plus an unrelated second agency. Leaves nobody signed in. */
export async function workWorld(page: Page): Promise<WorkWorld> {
  const agency = await seedDealsAgency();
  const org = { orgId: agency.orgId, branchId: agency.branchId };
  const person = (u: { id: string; email: string }): Person => ({ id: u.id, email: u.email });
  const agentB = await seedMember({ ...org, orgRole: "agent", firstName: "Bea", lastName: "Agentb" });
  const manager1 = await seedMember({ ...org, orgRole: "branch_manager", firstName: "Mona", lastName: "Manager" });
  const branch2 = await makeSecondBranch(agency.orgId);
  const agent2 = await seedMember({ orgId: agency.orgId, branchId: branch2.id, orgRole: "agent", firstName: "Sam", lastName: "Secondshop" });
  const manager2 = await seedMember({ orgId: agency.orgId, branchId: branch2.id, orgRole: "branch_manager", firstName: "Max", lastName: "Secondmanager" });
  const smm = await seedMember({ ...org, orgRole: "social_media_manager", firstName: "Sia", lastName: "Social" });
  const referral = await seedMember({ ...org, orgRole: "referral_agent", firstName: "Rita", lastName: "Referrer" });
  const noShop = await seedBranchlessMember({ orgId: agency.orgId, orgRole: "agent" });
  const hw = await seedHomeworker(agency.orgId);
  const foreignAgency = await seedDealsAgency();
  void page;
  return {
    agency,
    agent: { id: agency.agentId, email: agency.agentEmail },
    agentB: person(agentB),
    manager1: person(manager1),
    branch2Id: branch2.id,
    agent2: person(agent2),
    manager2: person(manager2),
    admin: { id: agency.adminId, email: agency.adminEmail },
    smm: person(smm),
    referral: person(referral),
    noShop: person(noShop),
    homeworker: { id: hw.id, email: hw.email, branchId: hw.branchId },
    foreign: {
      agent: { id: foreignAgency.agentId, email: foreignAgency.agentEmail },
      admin: { id: foreignAgency.adminId, email: foreignAgency.adminEmail },
      branchId: foreignAgency.branchId,
      orgId: foreignAgency.orgId,
    },
  };
}

/* ---------------------------------- tasks ---------------------------------- */

export interface TaskRowApi {
  id: string;
  title: string;
  userId: string | null;
  completed: boolean;
  priority: string;
  dueDate: string | null;
  entityType: string | null;
  entityId: string | null;
  branchId: string | null;
}

export async function apiCreateTask(request: APIRequestContext, body: Record<string, unknown>): Promise<TaskRowApi> {
  const res = await request.post("/api/v2/tasks", { data: { title: "Quote call", priority: "medium", completed: false, ...body } });
  return dataOf<TaskRowApi>(res, 201);
}

export async function dbTask(id: string) {
  const [row] = await queryRows<{
    id: string;
    title: string;
    user_id: string | null;
    completed: boolean;
    completed_at: string | null;
    priority: string;
    due_date: string | null;
    entity_type: string | null;
    entity_id: string | null;
    branch_id: string | null;
    description: string | null;
  }>(`select id, title, user_id, completed, completed_at::text as completed_at, priority, due_date::text as due_date, entity_type, entity_id, branch_id, description from tasks where id = $1`, [id]);
  // Zone-less UTC wall clocks, read as text and tagged UTC so this machine's own zone cannot shift them.
  const out = row && { ...row, completed_at: utcWallClock(row.completed_at), due_date: utcWallClock(row.due_date) };
  return out as NonNullable<typeof out>;
}

export async function expectStatus(res: APIResponse, status: number, label = ""): Promise<string> {
  const text = await res.text();
  expect(res.status(), `${label} -> ${text}`).toBe(status);
  return text;
}

export { signIn };

/* ------------------------------ dashboard money ----------------------------- */


export interface SeededBooking {
  transactionId: string;
  bookingId: string;
  quoteId: string;
  /** package commission + line-item commission, as seeded. */
  commission: number;
}

/**
 * A booked deal made by whoever the request is signed in as, with a known package commission and one transfer
 * with a known commission, then its booking date moved to `createdAt` (the dashboards window on that date).
 */
export async function seedBooking(
  request: APIRequestContext,
  w: BoardWorld,
  opts: { title: string; packageCommission: number; transferCommission?: number; salesPrice?: number; createdAt: Date; clientId?: string; travelDate?: string },
): Promise<SeededBooking> {
  const transfer = opts.transferCommission ?? 0;
  const deal = await bookedDeal(
    request,
    w,
    {
      title: opts.title,
      sales_price: String(opts.salesPrice ?? 2400),
      package_commission: opts.packageCommission.toFixed(2),
      extra:
        transfer > 0
          ? { transfers: [{ pick_up_location: "A", drop_off_location: "B", cost: "40.00", commission: transfer.toFixed(2), is_included_in_package: false }] }
          : {},
    },
    opts.clientId ?? w.clientId,
  );
  const [row] = await queryRows<{ id: string }>(`select id from booking_table where transaction_id = $1`, [deal.transactionId]);
  await queryRows(`update booking_table set date_created = $2::timestamptz where id = $1`, [row.id, opts.createdAt.toISOString()]);
  if (opts.travelDate) await queryRows(`update booking_table set travel_date = $2 where id = $1`, [row.id, opts.travelDate]);
  return { transactionId: deal.transactionId, bookingId: row.id, quoteId: deal.entityId, commission: opts.packageCommission + transfer };
}

export async function seedUpsell(
  request: APIRequestContext,
  bookingId: string,
  opts: { commission: number; salesPrice?: number; addedAt: Date },
): Promise<string> {
  const res = await request.post(`/api/v2/bookings/${bookingId}/upsells`, {
    data: {
      upsell_type: "FEE",
      description: "E2E upsell",
      sales_price: String(opts.salesPrice ?? opts.commission * 2),
      cost: String(opts.commission),
      commission: opts.commission.toFixed(2),
      added_at: opts.addedAt.toISOString(),
    },
  });
  return (await dataOf<{ id: string }>(res, 201)).id;
}
