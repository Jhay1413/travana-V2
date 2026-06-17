import { describe, it, expect, beforeEach } from "vitest";
import { revenueRepository } from "./revenue.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeTransaction,
  makeBooking, makeBookingUpsell,
} from "../../test/factories";

let orgA: { id: string };
let orgB: { id: string };
let agent: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
  agent = await makeUser();
});

// A booking with travel_date 2026-04-10 is recognised in FEBRUARY 2026 forwards,
// because the forwards window is [monthStart+56d, monthEnd+56d] and 2026-04-10
// sits in February's window (~Mar 29 – Apr 25) but not January's or March's. The
// mid-window date keeps the assertion robust against timezone boundary shifts.
const APR_10 = "2026-04-10";

describe("revenueRepository.getForwardsForMonth — 56-day forward window", () => {
  it("counts a booking in the month whose window its travel_date falls into", async () => {
    const txn = await makeTransaction({ user_id: agent.id });
    await makeBooking({ transaction_id: txn.id, travel_date: APR_10, package_commission: "500" });

    const feb = await revenueRepository.getForwardsForMonth(2026, 2, null);
    expect(feb.dealCount).toBe(1);
    expect(feb.totalCommission).toBe(500);
  });

  it("does NOT count that booking in the adjacent months", async () => {
    const txn = await makeTransaction({ user_id: agent.id });
    await makeBooking({ transaction_id: txn.id, travel_date: APR_10, package_commission: "500" });

    expect((await revenueRepository.getForwardsForMonth(2026, 1, null)).dealCount).toBe(0);
    expect((await revenueRepository.getForwardsForMonth(2026, 3, null)).dealCount).toBe(0);
  });

  it("ignores bookings with no package_commission", async () => {
    const txn = await makeTransaction({ user_id: agent.id });
    await makeBooking({ transaction_id: txn.id, travel_date: APR_10, package_commission: null });

    expect((await revenueRepository.getForwardsForMonth(2026, 2, null)).dealCount).toBe(0);
  });
});

describe("revenueRepository.getForwardsForMonth — org scoping", () => {
  it("only sums bookings whose client belongs to the requested org", async () => {
    const clientA = await makeClient({ orgId: orgA.id });
    const clientB = await makeClient({ orgId: orgB.id });
    const txnA = await makeTransaction({ user_id: agent.id, org_id: orgA.id, client_id: clientA.id });
    const txnB = await makeTransaction({ user_id: agent.id, org_id: orgB.id, client_id: clientB.id });
    await makeBooking({ transaction_id: txnA.id, travel_date: APR_10, package_commission: "500" });
    await makeBooking({ transaction_id: txnB.id, travel_date: APR_10, package_commission: "999" });

    const scopedToA = await revenueRepository.getForwardsForMonth(2026, 2, orgA.id);
    expect(scopedToA.dealCount).toBe(1);
    expect(scopedToA.totalCommission).toBe(500); // orgB's 999 excluded
  });
});

describe("revenueRepository.getForwardsForMonth — upsell recognition", () => {
  it("adds upsell commission recognised in the same calendar month", async () => {
    const txn = await makeTransaction({ user_id: agent.id });
    const b = await makeBooking({ transaction_id: txn.id, travel_date: APR_10, package_commission: "500" });
    // Upsell ADDED in February (by added_at) — recognised in Feb regardless of the
    // booking's forward window.
    await makeBookingUpsell({ booking_id: b.id, commission: "100", added_at: new Date("2026-02-15T12:00:00Z") });

    const feb = await revenueRepository.getForwardsForMonth(2026, 2, null);
    expect(feb.dealCount).toBe(1); // upsell does not add to the deal count
    expect(feb.totalCommission).toBe(600); // 500 booking + 100 upsell
  });
});

describe("revenueRepository.getAgentPerformance — GROUP BY agent", () => {
  it("groups commission per agent and orders by total descending", async () => {
    const agent2 = await makeUser();
    // travel_date within the [now, now+1yr] window, computed relative to runtime.
    const soon = new Date();
    soon.setDate(soon.getDate() + 90);
    const travelDate = soon.toISOString().split("T")[0];

    const txn1 = await makeTransaction({ user_id: agent.id });
    const txn2 = await makeTransaction({ user_id: agent2.id });
    await makeBooking({ transaction_id: txn1.id, travel_date: travelDate, package_commission: "300" });
    await makeBooking({ transaction_id: txn2.id, travel_date: travelDate, package_commission: "800" });

    const rows = await revenueRepository.getAgentPerformance(null);

    expect(rows).toHaveLength(2);
    // highest commission first
    expect(rows[0]).toMatchObject({ agentId: agent2.id, totalCommission: 800, dealCount: 1 });
    expect(rows[1]).toMatchObject({ agentId: agent.id, totalCommission: 300, dealCount: 1 });
  });
});
