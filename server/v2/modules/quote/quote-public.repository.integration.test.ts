import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { quotePublicRepository } from "./quote-public.repository";
import { blockFor } from "./quote-public.service";
import { db } from "../../config/database";
import { clientTable, quote } from "@shared/schema";
import { truncateAll, makeOrg, makeUser, makeTransaction, makeClient, makeQuote, makeBooking } from "../../test/factories";

// WRITTEN, NOT RUN: needs the test database (npm run db:test:up && db:test:push, then npm run test:integration).
// Covers the public link's access rule against real rows: it reuses the portal's visibility predicate.

let orgId: string;
let agentId: string;
let clientId: string;

async function dealQuote(over: Record<string, unknown> = {}, txnOver: Record<string, unknown> = {}, withClient = true) {
  const txn = await makeTransaction({ user_id: agentId, org_id: orgId, client_id: withClient ? clientId : null, ...txnOver });
  const q = await makeQuote({ transaction_id: txn.id, quote_token: `TOK${Math.random().toString(36).slice(2, 12)}`, ...over });
  return { txn, q };
}

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg({ name: "Tinas Travel", settings: { profile: { phone: "0191 594 7999" } } });
  orgId = org.id;
  agentId = (await makeUser()).id;
  clientId = (await makeClient({ orgId })).id;
});

describe("quotePublicRepository.findAccessState", () => {
  it("an active quote is visible, not booked, with the agency's name and phone", async () => {
    const { q } = await dealQuote();
    const state = await quotePublicRepository.findAccessState(q.id);
    expect(state).toMatchObject({ visible: true, isBooked: false, clientDeleted: false, agencyName: "Tinas Travel" });
    expect(blockFor(state)).toBeNull();
    expect(blockFor({ ...state!, visible: false })?.agency).toEqual({ name: "Tinas Travel", phone: "0191 594 7999" });
  });

  it.each([
    ["lost", { quote_status: "lost" }, {}],
    ["archived", { quote_status: "archived" }, {}],
    ["inactive quote", { is_active: false }, {}],
    ["deactivated deal", {}, { is_active: false }],
    ["test deal", {}, { is_test: true }],
  ])("%s is not visible", async (_label, quoteOver, txnOver) => {
    const { q } = await dealQuote(quoteOver, txnOver);
    expect((await quotePublicRepository.findAccessState(q.id))?.visible).toBe(false);
  });

  it("accepted and expired quotes stay visible", async () => {
    const { q } = await dealQuote({ quote_status: "in_play", date_expiry: new Date("2020-01-01T00:00:00Z") });
    const state = await quotePublicRepository.findAccessState(q.id);
    expect(state?.visible).toBe(true);
    expect(state?.dateExpiry).toBeTruthy();
  });

  it("a deal with a live booking is booked; a lost booking does not count", async () => {
    const { q, txn } = await dealQuote();
    expect((await quotePublicRepository.findAccessState(q.id))?.isBooked).toBe(false);
    const lostBooking = await makeBooking({ transaction_id: txn.id, booking_status: "LOST" });
    expect((await quotePublicRepository.findAccessState(q.id))?.isBooked).toBe(false);
    await db.delete((await import("@shared/schema")).booking).where(eq((await import("@shared/schema")).booking.id, lostBooking.id));
    await makeBooking({ transaction_id: txn.id, booking_status: null });
    // A booking with no status counts as booked (same rule as the portal).
    expect((await quotePublicRepository.findAccessState(q.id))?.isBooked).toBe(true);
  });

  it("a soft-deleted client is flagged; a deal with no client is not", async () => {
    const { q } = await dealQuote();
    await db.update(clientTable).set({ deletedAt: new Date() }).where(eq(clientTable.id, clientId));
    expect((await quotePublicRepository.findAccessState(q.id))?.clientDeleted).toBe(true);

    const social = await dealQuote({}, {}, false);
    const state = await quotePublicRepository.findAccessState(social.q.id);
    expect(state).toMatchObject({ visible: true, clientDeleted: false });
  });
});

describe("tokens", () => {
  it("setToken mints a 20 character token once and keeps it", async () => {
    const { q } = await dealQuote({ quote_token: null });
    const first = await quotePublicRepository.setToken(q.id);
    expect(first).toMatch(/^[A-HJ-NP-Za-km-z2-9]{20}$/);
    expect(await quotePublicRepository.setToken(q.id)).toBe(first);
  });

  it("a duplicated token resolves to nothing, never to an arbitrary quote (needs the unique index absent)", async () => {
    const a = await dealQuote({ quote_token: "DUPTOKEN1" }).catch(() => null);
    // With the unique index pushed the second insert is refused, which is the point of the index.
    const b = await dealQuote({ quote_token: "DUPTOKEN1" }).catch(() => null);
    if (a && b) expect(await quotePublicRepository.findQuoteIdByToken("DUPTOKEN1")).toBeNull();
    else expect(await quotePublicRepository.findQuoteIdByToken("DUPTOKEN1")).toBe(a?.q.id ?? null);
  });

  it("the unique index refuses a second quote with the same token but allows many without one", async () => {
    await dealQuote({ quote_token: "UNIQ0001" });
    await expect(dealQuote({ quote_token: "UNIQ0001" })).rejects.toThrow();
    await dealQuote({ quote_token: null });
    await dealQuote({ quote_token: null });
    const rows = await db.select({ id: quote.id }).from(quote).where(eq(quote.quote_token, "UNIQ0001"));
    expect(rows).toHaveLength(1);
  });
});
