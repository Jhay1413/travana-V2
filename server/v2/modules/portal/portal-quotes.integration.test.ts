import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../../config/database";
import { notifications, quote, quoteCustomerActionsTable } from "@shared/schema";
import { truncateAll, makeOrg, makeUser, makeClient, makeTransaction, makeQuote, makeBooking } from "../../test/factories";
import { portalQuotesService } from "./portal-quotes.service";

// DB-backed: proves the REAL SQL keeps one customer's quotes away from another and that every decision writes
// exactly one action row and one notification. Written to run under `npm run test:integration` against the
// disposable test database.

let agent: { id: string };
let customerA: { id: string };
let customerB: { id: string };
let orgA: { id: string };
let orgOther: { id: string };
let customerOther: { id: string };
let quoteA: { id: string; quote_token: string | null; transaction_id: string };
let quoteB: { id: string; quote_token: string | null };

async function customerQuote(clientId: string, orgId: string, token: string, title: string) {
  const txn = await makeTransaction({ user_id: agent.id, org_id: orgId, client_id: clientId, status: "on_quote" });
  return makeQuote({ transaction_id: txn.id, title, is_active: true, quote_token: token, sales_price: "1000.00", adult: 2 });
}

const actionRows = (quoteId: string) =>
  db.select().from(quoteCustomerActionsTable).where(eq(quoteCustomerActionsTable.quoteId, quoteId));

const agentNotifications = (type: string) =>
  db.select().from(notifications).where(and(eq(notifications.userId, agent.id), eq(notifications.type, type)));

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg({ slug: "agency-quotes" });
  orgA = org;
  orgOther = await makeOrg({ slug: "agency-other" });
  agent = await makeUser({ orgId: org.id });
  customerOther = await makeClient({ orgId: orgOther.id, firstName: "Olga", surename: "Other" });
  customerA = await makeClient({ orgId: org.id, firstName: "Ada", surename: "Alpha" });
  customerB = await makeClient({ orgId: org.id, firstName: "Ben", surename: "Beta" });
  quoteA = await customerQuote(customerA.id, org.id, "TOKAAAAA", "Quote for A");
  quoteB = await customerQuote(customerB.id, org.id, "TOKBBBBB", "Quote for B");
});

describe("a customer only ever sees and acts on their own quotes", () => {
  it("the list holds only the customer's own quotes", async () => {
    const a = await portalQuotesService.listQuotes(customerA.id);
    const b = await portalQuotesService.listQuotes(customerB.id);
    expect(a.map((q) => q.id)).toEqual([quoteA.id]);
    expect(b.map((q) => q.id)).toEqual([quoteB.id]);
  });

  it("customer A cannot read customer B's quote: 404, the same as for a token that does not exist", async () => {
    await expect(portalQuotesService.getQuote(customerA.id, "TOKBBBBB")).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalQuotesService.getQuote(customerA.id, "NOSUCHTOK")).rejects.toMatchObject({ statusCode: 404 });
    expect((await portalQuotesService.getQuote(customerB.id, "TOKBBBBB")).title).toBe("Quote for B");
  });

  it("customer A cannot act on customer B's quote: 404, and nothing is written or notified", async () => {
    for (const action of ["interested", "declined", "reopened"] as const) {
      await expect(portalQuotesService.recordAction(customerA.id, "TOKBBBBB", { action })).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(await actionRows(quoteB.id)).toHaveLength(0);
    expect(await agentNotifications("quote_accepted")).toHaveLength(0);
    expect(await agentNotifications("quote_declined")).toHaveLength(0);
  });

  async function publishedDeal(orgId: string, token: string, txnOver: Record<string, unknown> = {}) {
    const dealTxn = await makeTransaction({ user_id: agent.id, org_id: orgId, status: "on_quote", ...txnOver });
    return makeQuote({ transaction_id: dealTxn.id, title: "Published deal", is_active: true, quote_token: token, show_on_portal: true, isFreeQuote: true });
  }

  it("a published deal of the customer's OWN agency can be read but never acted on; its share is offered (no customer on it)", async () => {
    await publishedDeal(orgA.id, "TOKDEAL1");
    const deal = await portalQuotesService.getQuote(customerB.id, "TOKDEAL1");
    expect(deal.canDecide).toBe(false);
    expect(deal.canShare).toBe(true);
    await expect(portalQuotesService.recordAction(customerB.id, "TOKDEAL1", { action: "interested" })).rejects.toMatchObject({ statusCode: 404 });
    expect(await portalQuotesService.checkOwnership(customerB.id, "TOKDEAL1")).toEqual({ found: true, owns: false, isPublicDeal: true });
  });

  it("a published deal of ANOTHER agency is a 404 to read, act on and view, and owns says it is not a public deal", async () => {
    await publishedDeal(orgOther.id, "TOKDEAL2");
    await expect(portalQuotesService.getQuote(customerA.id, "TOKDEAL2")).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalQuotesService.getReadable(customerA.id, "TOKDEAL2")).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalQuotesService.recordAction(customerA.id, "TOKDEAL2", { action: "interested" })).rejects.toMatchObject({ statusCode: 404 });
    expect(await portalQuotesService.checkOwnership(customerA.id, "TOKDEAL2")).toEqual({ found: true, owns: false, isPublicDeal: false });
    // ...but the other agency's own customer reads it.
    expect((await portalQuotesService.getQuote(customerOther.id, "TOKDEAL2")).title).toBe("Published deal");
  });

  it("a customer with no agency reads no deals", async () => {
    await publishedDeal(orgA.id, "TOKDEAL3");
    const orphan = await makeClient({ orgId: null });
    await expect(portalQuotesService.getQuote(orphan.id, "TOKDEAL3")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a published deal that has a real customer on it is readable by the agency's customers but never offered for sharing", async () => {
    const txn = await makeTransaction({ user_id: agent.id, org_id: orgA.id, client_id: customerA.id, status: "on_quote" });
    await makeQuote({ transaction_id: txn.id, title: "Deal with client", is_active: true, quote_token: "TOKDEAL4", show_on_portal: true, isFreeQuote: true });
    const seen = await portalQuotesService.getQuote(customerB.id, "TOKDEAL4");
    expect(seen.canShare).toBe(false);
  });

  it("a quote on a dead deal or a test deal is not in the list and its token is a 404 for reading and acting", async () => {
    const dead = await makeTransaction({ user_id: agent.id, org_id: orgA.id, client_id: customerA.id, status: "on_quote", is_active: false });
    await makeQuote({ transaction_id: dead.id, title: "Dead deal", is_active: true, quote_token: "TOKDEAD1" });
    const test = await makeTransaction({ user_id: agent.id, org_id: orgA.id, client_id: customerA.id, status: "on_quote", is_test: true });
    await makeQuote({ transaction_id: test.id, title: "Test deal", is_active: true, quote_token: "TOKTEST1" });
    expect((await portalQuotesService.listQuotes(customerA.id)).map((q) => q.title)).toEqual(["Quote for A"]);
    for (const t of ["TOKDEAD1", "TOKTEST1"]) {
      await expect(portalQuotesService.getQuote(customerA.id, t)).rejects.toMatchObject({ statusCode: 404 });
      await expect(portalQuotesService.recordAction(customerA.id, t, { action: "interested" })).rejects.toMatchObject({ statusCode: 404 });
    }
  });
});

describe("each action writes one row and one notification", () => {
  it("interested: one 'accepted' row (name from the session) and one quote_accepted notification", async () => {
    const res = await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "interested", note: "A sea view" });
    expect(res.decision).toMatchObject({ state: "interested", note: "A sea view" });
    const rows = await actionRows(quoteA.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actionType: "accepted", message: "A sea view", customerName: "Ada Alpha", reason: null, wantsSimilar: null });
    const bell = await agentNotifications("quote_accepted");
    expect(bell).toHaveLength(1);
    expect(bell[0].message).toContain("Ada Alpha wants to book");
  });

  it("declined: one row with the reason and the similar flag, and one quote_declined notification that carries the reason", async () => {
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "declined", reason: "Wrong dates", note: "A week later", wantsSimilar: true });
    const rows = await actionRows(quoteA.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actionType: "declined", reason: "Wrong dates", wantsSimilar: true, message: "A week later" });
    const bell = await agentNotifications("quote_declined");
    expect(bell).toHaveLength(1);
    expect(bell[0].message).toContain("Wrong dates");
    expect(bell[0].message).toContain("something similar");
  });

  it("reopened after a decline: one more row and one quote_reopened notification, and the quote is back in play", async () => {
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "declined" });
    // Past the double-tap window so the undo is a new action, not a repeat.
    await db.update(quoteCustomerActionsTable).set({ createdAt: new Date(Date.now() - 60_000) }).where(eq(quoteCustomerActionsTable.quoteId, quoteA.id));
    const res = await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "reopened" });
    expect(res.decision.state).toBe("none");
    expect((await actionRows(quoteA.id)).map((r) => r.actionType).sort()).toEqual(["declined", "reopened"]);
    expect(await agentNotifications("quote_reopened")).toHaveLength(1);
    const [listed] = await portalQuotesService.listQuotes(customerA.id);
    expect(listed.decision.state).toBe("none");
  });

  it("interested twice writes and notifies once, even minutes apart", async () => {
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "interested" });
    await db.update(quoteCustomerActionsTable).set({ createdAt: new Date(Date.now() - 10 * 60_000) }).where(eq(quoteCustomerActionsTable.quoteId, quoteA.id));
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "interested" });
    expect(await actionRows(quoteA.id)).toHaveLength(1);
    expect(await agentNotifications("quote_accepted")).toHaveLength(1);
  });

  it("decline, undo, decline in quick succession writes three rows and three notifications", async () => {
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "declined", reason: "Wrong dates", wantsSimilar: true });
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "reopened" });
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "declined", reason: "Wrong dates", wantsSimilar: true });
    expect((await actionRows(quoteA.id)).map((r) => r.actionType).sort()).toEqual(["declined", "declined", "reopened"]);
    expect(await agentNotifications("quote_declined")).toHaveLength(2);
    expect(await agentNotifications("quote_reopened")).toHaveLength(1);
  });

  it("the same action twice in a row writes and notifies once", async () => {
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "interested" });
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "interested" });
    expect(await actionRows(quoteA.id)).toHaveLength(1);
    expect(await agentNotifications("quote_accepted")).toHaveLength(1);
  });

  it("the list shows each quote's latest decision", async () => {
    await portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "declined", reason: "Too expensive", wantsSimilar: true });
    const [item] = await portalQuotesService.listQuotes(customerA.id);
    expect(item.decision).toMatchObject({ state: "declined", reason: "Too expensive", wantsSimilar: true });
    const [other] = await portalQuotesService.listQuotes(customerB.id);
    expect(other.decision.state).toBe("none");
  });
});

describe("lost, archived and booked quotes (real SQL)", () => {
  const setStatus = (quoteId: string, status: "lost" | "archived" | "quoted" | "in_play" | null) =>
    db.update(quote).set({ quote_status: status }).where(eq(quote.id, quoteId));

  it("a quote staff marked lost or archived is out of the list and its link is not found for reading and acting; quoted, in play and no status stay", async () => {
    for (const status of ["lost", "archived"] as const) {
      await setStatus(quoteA.id, status);
      expect(await portalQuotesService.listQuotes(customerA.id)).toEqual([]);
      await expect(portalQuotesService.getQuote(customerA.id, "TOKAAAAA")).rejects.toMatchObject({ statusCode: 404 });
      await expect(portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "interested" })).rejects.toMatchObject({ statusCode: 404 });
      expect(await portalQuotesService.checkOwnership(customerA.id, "TOKAAAAA")).toEqual({ found: false, owns: false, isPublicDeal: false });
    }
    expect(await actionRows(quoteA.id)).toHaveLength(0);
    for (const status of ["quoted", "in_play", null] as const) {
      await setStatus(quoteA.id, status);
      expect((await portalQuotesService.listQuotes(customerA.id)).map((q) => q.id)).toEqual([quoteA.id]);
      expect((await portalQuotesService.getQuote(customerA.id, "TOKAAAAA")).id).toBe(quoteA.id);
    }
  });

  it("a quote whose deal has an active BOOKED booking: the owner's link answers 410 BOOKED, others get 404, actions are refused", async () => {
    await makeBooking({ transaction_id: quoteA.transaction_id, booking_status: "BOOKED", is_active: true });
    expect(await portalQuotesService.listQuotes(customerA.id)).toEqual([]);
    await expect(portalQuotesService.getQuote(customerA.id, "TOKAAAAA")).rejects.toMatchObject({ statusCode: 410, code: "BOOKED" });
    await expect(portalQuotesService.getQuote(customerB.id, "TOKAAAAA")).rejects.toMatchObject({ statusCode: 404 });
    await expect(portalQuotesService.recordAction(customerA.id, "TOKAAAAA", { action: "interested" })).rejects.toMatchObject({ statusCode: 410, code: "BOOKED" });
    expect(await actionRows(quoteA.id)).toHaveLength(0);
    expect(await agentNotifications("quote_accepted")).toHaveLength(0);
  });

  it("a booking with no status counts as live (as in the bookings list), so it closes the quote too", async () => {
    await makeBooking({ transaction_id: quoteA.transaction_id, booking_status: null, is_active: true });
    expect(await portalQuotesService.listQuotes(customerA.id)).toEqual([]);
    await expect(portalQuotesService.getQuote(customerA.id, "TOKAAAAA")).rejects.toMatchObject({ statusCode: 410, code: "BOOKED" });
  });

  it("a LOST or inactive booking does not close the quote", async () => {
    await makeBooking({ transaction_id: quoteA.transaction_id, booking_status: "LOST", is_active: true });
    expect((await portalQuotesService.getQuote(customerA.id, "TOKAAAAA")).id).toBe(quoteA.id);
  });
});
