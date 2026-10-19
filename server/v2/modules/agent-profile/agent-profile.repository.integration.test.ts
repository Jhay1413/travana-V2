// Needs a live Postgres: run with `npm run test:integration`. Written, not run by `npm test`.
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../config/database";
import { quoteViewsTable } from "@shared/schema";
import { agentProfileRepository } from "./agent-profile.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeBranchMember,
  makeTransaction, makeBooking, makeBookingUpsell, makeQuote,
} from "../../test/factories";

const WINDOW = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-11-01T00:00:00Z") };
const IN_WINDOW = new Date("2026-10-15T12:00:00Z");

let orgA: { id: string };
let orgB: { id: string };
let branchX: { id: string };
let branchY: { id: string };
let ann: { id: string };
let bob: { id: string };

async function deal(orgId: string, branchId: string, userId: string) {
  const client = await makeClient({ orgId });
  return makeTransaction({ user_id: userId, org_id: orgId, branch_id: branchId, client_id: client.id });
}

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
  branchX = await makeBranch(orgA.id, { name: "X" });
  branchY = await makeBranch(orgA.id, { name: "Y" });
  const branchZ = await makeBranch(orgB.id, { name: "Z" });
  ann = await makeUser();
  bob = await makeUser();
  await makeBranchMember({ orgId: orgA.id, branchId: branchX.id, userId: ann.id, orgRole: "agent" });
  await makeBranchMember({ orgId: orgA.id, branchId: branchY.id, userId: bob.id, orgRole: "agent" });

  // Ann on X: GBP 1000 booking + GBP 50 upsell, a quote with 2 views, a LOST booking departing 20 Oct, a live one on 21 Oct.
  const t1 = await deal(orgA.id, branchX.id, ann.id);
  const b1 = await makeBooking({ transaction_id: t1.id, package_commission: "1000", sales_price: "8000", date_created: IN_WINDOW, travel_date: "2026-10-21", booking_status: "BOOKED" });
  await makeBookingUpsell({ booking_id: b1.id, commission: "50", sales_price: "200", added_at: IN_WINDOW });
  const q1 = await makeQuote({ transaction_id: t1.id, date_created: IN_WINDOW });
  await db.insert(quoteViewsTable).values([{ quoteId: q1.id, viewedAt: IN_WINDOW }, { quoteId: q1.id, viewedAt: IN_WINDOW }]);
  const t2 = await deal(orgA.id, branchX.id, ann.id);
  await makeBooking({ transaction_id: t2.id, package_commission: "10", date_created: IN_WINDOW, travel_date: "2026-10-20", booking_status: "LOST" });

  // Bob on Y (same org) and a stranger in another org: neither may leak into Ann's reads.
  const t3 = await deal(orgA.id, branchY.id, bob.id);
  await makeBooking({ transaction_id: t3.id, package_commission: "400", sales_price: "3000", date_created: IN_WINDOW });
  const stranger = await makeUser();
  const t4 = await deal(orgB.id, branchZ.id, stranger.id);
  await makeBooking({ transaction_id: t4.id, package_commission: "9999", date_created: IN_WINDOW });
});

describe("agentProfileRepository (integration)", () => {
  it("window totals include upsells and respect user, branch and organisation", async () => {
    const own = await agentProfileRepository.getWindowTotals({ orgId: orgA.id, userId: ann.id }, WINDOW);
    expect(own.profit).toBe(1060);
    expect(own.bookings).toBe(2);
    expect(own.sales).toBe(8200);

    const org = await agentProfileRepository.getWindowTotals({ orgId: orgA.id }, WINDOW);
    expect(org.profit).toBe(1460);

    const branch = await agentProfileRepository.getWindowTotals({ orgId: orgA.id, branchId: branchY.id }, WINDOW);
    expect(branch.profit).toBe(400);

    const wrongBranch = await agentProfileRepository.getWindowTotals({ orgId: orgA.id, branchId: branchY.id, userId: ann.id }, WINDOW);
    expect(wrongBranch.profit).toBe(0);
  });

  it("counts quotes and their views in the window", async () => {
    expect(await agentProfileRepository.getQuoteWindowCounts({ orgId: orgA.id, userId: ann.id }, WINDOW)).toEqual({ quotesSent: 1, quotedDeals: 1 });
    expect(await agentProfileRepository.countQuoteViews({ orgId: orgA.id, userId: ann.id }, WINDOW)).toBe(2);
    expect(await agentProfileRepository.countQuoteViews({ orgId: orgA.id, userId: bob.id }, WINDOW)).toBe(0);
  });

  it("lists departures without lost bookings and biggest deals by commission", async () => {
    const departures = await agentProfileRepository.listDepartures({ orgId: orgA.id, userId: ann.id }, "2026-10-19", "2026-10-26");
    expect(departures.map((d) => d.travelDate)).toEqual(["2026-10-21"]);

    const deals = await agentProfileRepository.listBiggestDeals({ orgId: orgA.id, userId: ann.id }, 5);
    expect(deals.map((d) => d.commission)).toEqual([1000, 10]);
  });

  it("lifetime profit covers every booking and upsell of the agent only", async () => {
    expect(await agentProfileRepository.getLifetimeProfit({ orgId: orgA.id, userId: ann.id })).toBe(1060);
  });

  it("memberships and the subject lookup are organisation scoped", async () => {
    expect((await agentProfileRepository.listMemberships(ann.id, orgA.id)).map((m) => m.branchId)).toEqual([branchX.id]);
    expect(await agentProfileRepository.listMemberships(ann.id, orgB.id)).toEqual([]);
    expect(await agentProfileRepository.findSubjectUser(ann.id, orgB.id)).toBeNull();
    expect((await agentProfileRepository.findSubjectUser(ann.id, orgA.id))?.id).toBe(ann.id);
  });
});
