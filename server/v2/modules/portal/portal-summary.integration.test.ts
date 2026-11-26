import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../config/database";
import { quote } from "@shared/schema";
import { eq } from "drizzle-orm";
import { truncateAll, makeOrg, makeUser, makeClient, makeTransaction, makeQuote, makeBooking } from "../../test/factories";
import { portalSummaryService } from "./portal-summary.service";
import { portalService } from "./portal.service";
import { portalMessages } from "@shared/schema";

// DB-backed: proves the REAL SQL keeps one customer's quotes and bookings out of another's summary, drops LOST
// bookings and dead quotes, and returns only the allowlisted keys. Written to run under `npm run test:integration`
// against the disposable test database.

let agent: { id: string };
let orgId: string;
let me: { id: string };
let other: { id: string };

const future = (days: number) => new Date(Date.now() + days * 86_400_000);
const ymd = (days: number) => future(days).toISOString().slice(0, 10);

async function quoteFor(clientId: string, token: string, title: string, expiresInDays: number | null) {
  const txn = await makeTransaction({ user_id: agent.id, org_id: orgId, client_id: clientId, status: "on_quote" });
  const q = await makeQuote({ transaction_id: txn.id, title, is_active: true, quote_token: token, sales_price: "1000.00", adult: 2 });
  if (expiresInDays !== null) await db.update(quote).set({ date_expiry: future(expiresInDays) }).where(eq(quote.id, q.id));
  return q;
}

async function bookingFor(clientId: string, title: string, startInDays: number, status: "BOOKED" | "LOST" = "BOOKED") {
  const txn = await makeTransaction({ user_id: agent.id, org_id: orgId, client_id: clientId, status: "booked" });
  return makeBooking({ transaction_id: txn.id, title, travel_date: ymd(startInDays), num_of_nights: 7, adult: 2, booking_status: status });
}

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg({ slug: "agency-summary" });
  orgId = org.id;
  agent = await makeUser({ orgId });
  me = await makeClient({ orgId, firstName: "Ada", surename: "Alpha" });
  other = await makeClient({ orgId, firstName: "Ben", surename: "Beta" });
});

describe("portalSummaryService.getSummary (real database)", () => {
  it("contains only the signed-in customer's own quotes and bookings", async () => {
    await quoteFor(me.id, "MINE0001", "My Rome", 5);
    await quoteFor(other.id, "THEIRS01", "Their Paris", 1);
    await bookingFor(me.id, "My Majorca", 30);
    await bookingFor(other.id, "Their Cyprus", 3);

    const s = await portalSummaryService.getSummary(me.id);
    expect(s.firstName).toBe("Ada");
    expect(s.counts).toEqual({ quotesAwaiting: 1, upcomingBookings: 1 });
    expect(s.priceHeld?.token).toBe("MINE0001");
    expect(s.nextBooking?.title).toBe("My Majorca");
    const json = JSON.stringify(s);
    expect(json).not.toContain("THEIRS01");
    expect(json).not.toContain("Their");
    expect(json).not.toContain("Ben");
  });

  it("leaves out LOST bookings and bookings that have already ended", async () => {
    await bookingFor(me.id, "Lost trip", 10, "LOST");
    await bookingFor(me.id, "Ended trip", -40);
    await bookingFor(me.id, "Real trip", 60);
    const s = await portalSummaryService.getSummary(me.id);
    expect(s.counts.upcomingBookings).toBe(1);
    expect(s.nextBooking?.title).toBe("Real trip");
  });

  it("a customer with nothing gets an empty summary", async () => {
    const s = await portalSummaryService.getSummary(me.id);
    expect(s).toEqual({ firstName: "Ada", counts: { quotesAwaiting: 0, upcomingBookings: 0 }, nextBooking: null, priceHeld: null, rewards: { walletCredit: 0, rewardWaiting: false }, toldDealIds: [] });
  });

  it("only allowlisted keys, nothing from the cost side", async () => {
    await quoteFor(me.id, "MINE0002", "Cost check", 4);
    await bookingFor(me.id, "Cost check trip", 20);
    const s = await portalSummaryService.getSummary(me.id);
    expect(Object.keys(s).sort()).toEqual(["counts", "firstName", "nextBooking", "priceHeld", "rewards", "toldDealIds"]);
    expect(JSON.stringify(s)).not.toMatch(/cost|commission|margin|supplier|hays/i);
  });
});

describe("deal interest (real database)", () => {
  async function liveDeal(inOrg: string, title: string) {
    const txn = await makeTransaction({ user_id: agent.id, org_id: inOrg, status: "on_quote" });
    return makeQuote({ transaction_id: txn.id, title, is_active: true, quote_token: `DEAL${Math.random().toString(36).slice(2, 10)}`, show_on_portal: true, isFreeQuote: true, sales_price: "500.00", adult: 2 });
  }

  it("messages the agent with the deal's name once per customer and deal, reports it as told, and never shows it to another customer", async () => {
    const deal = await liveDeal(orgId, "Cyprus Beach Deal");
    const first = await portalService.recordInterest(me.id, deal.id);
    const again = await portalService.recordInterest(me.id, deal.id);
    expect(first).toEqual({ alreadyTold: false });
    expect(again).toEqual({ alreadyTold: true });
    const rows = await db.select().from(portalMessages).where(eq(portalMessages.clientId, me.id));
    expect(rows.filter((r) => r.text.includes(deal.id))).toHaveLength(1);
    expect(rows[0].text).toBe(`❤️ Interested in deal: Cyprus Beach Deal [deal:${deal.id}]`);
    expect((await portalService.listMessages(me.id))[0].text).toBe("❤️ Interested in deal: Cyprus Beach Deal");

    expect((await portalSummaryService.getSummary(me.id)).toldDealIds).toEqual([deal.id]);
    expect((await portalSummaryService.getSummary(other.id)).toldDealIds).toEqual([]);
    expect(await portalService.recordInterest(other.id, deal.id)).toEqual({ alreadyTold: false });
  });

  it("refuses a deal that belongs to another agency", async () => {
    const otherOrg = await makeOrg({ slug: "agency-other" });
    const foreign = await liveDeal(otherOrg.id, "Foreign deal");
    await expect(portalService.recordInterest(me.id, foreign.id)).rejects.toMatchObject({ statusCode: 404 });
  });
});
