import { describe, it, expect, beforeEach } from "vitest";
import { organizationOverviewRepository } from "./organization-overview.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeBranchMember,
  makeTransaction, makeBooking, makeBookingUpsell, makeQuote, makeShopTarget,
} from "../../test/factories";

const MONTH_START = new Date(2026, 0, 1);
const MONTH_END = new Date(2026, 1, 1);
const NOW = new Date(2026, 0, 15); // drives which shop_target row matches (year/month)
const IN_MONTH = new Date("2026-01-15T12:00:00Z");

let orgA: { id: string };
let branchX: { id: string };
let branchY: { id: string };
let branchW: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  const orgB = await makeOrg();
  branchX = await makeBranch(orgA.id, { name: "Branch X" });
  branchY = await makeBranch(orgA.id, { name: "Branch Y" });
  branchW = await makeBranch(orgA.id, { name: "Branch W" }); // no activity
  const branchZ = await makeBranch(orgB.id, { name: "Branch Z" }); // different org
  const client = await makeClient({ orgId: orgA.id });
  const agent = await makeUser();

  const txn = (branchId: string) =>
    makeTransaction({ user_id: agent.id, org_id: orgA.id, branch_id: branchId, client_id: client.id });

  // Branch X: £1000 booking + 1 quote, 2 members, £2000 Jan target → 50%
  const tx1 = await txn(branchX.id);
  const tx2 = await txn(branchX.id);
  await makeBooking({ transaction_id: tx1.id, travel_date: "2026-06-01", package_commission: "1000", date_created: IN_MONTH });
  await makeQuote({ transaction_id: tx2.id, date_created: IN_MONTH });
  await makeBranchMember({ orgId: orgA.id, branchId: branchX.id, userId: agent.id, orgRole: "agent" });
  await makeBranchMember({ orgId: orgA.id, branchId: branchX.id, userId: (await makeUser()).id, orgRole: "agent" });
  await makeShopTarget({ branchId: branchX.id, year: 2026, month: 1, targetAmount: "2000" });

  // Branch Y: £400 booking only
  const ty = await txn(branchY.id);
  await makeBooking({ transaction_id: ty.id, travel_date: "2026-06-01", package_commission: "400", date_created: IN_MONTH });

  // Branch Z (orgB): £9999 — must not appear when scoped to orgA
  const tz = await txn(branchZ.id);
  await makeBooking({ transaction_id: tz.id, travel_date: "2026-06-01", package_commission: "9999", date_created: IN_MONTH });
  void branchW;
});

describe("organizationOverviewRepository.getBranchLeaderboard", () => {
  it("ranks the org's branches by commission, including idle branches as zero rows", async () => {
    const rows = await organizationOverviewRepository.getBranchLeaderboard(orgA.id, MONTH_START, MONTH_END, NOW);

    // Only orgA branches; sorted by commission desc, then name. Branch Z (orgB) absent.
    expect(rows.map((r) => r.name)).toEqual(["Branch X", "Branch Y", "Branch W"]);
  });

  it("computes each branch's bookings, quotes, members and percentToTarget", async () => {
    const rows = await organizationOverviewRepository.getBranchLeaderboard(orgA.id, MONTH_START, MONTH_END, NOW);
    const x = rows.find((r) => r.name === "Branch X")!;
    const y = rows.find((r) => r.name === "Branch Y")!;
    const w = rows.find((r) => r.name === "Branch W")!;

    expect(x).toMatchObject({ bookings: 1, commission: 1000, quotes: 1, memberCount: 2, monthTarget: 2000, percentToTarget: 50 });
    expect(y).toMatchObject({ bookings: 1, commission: 400, quotes: 0, memberCount: 0, monthTarget: 0, percentToTarget: 0 });
    expect(w).toMatchObject({ bookings: 0, commission: 0, quotes: 0, memberCount: 0 });
  });
});

describe("organizationOverviewRepository compare + profit sources", () => {
  const WINDOW_NOW = { from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-02-01T00:00:00Z") };
  const WINDOW_OTHER = { from: new Date("2025-12-01T00:00:00Z"), to: new Date("2026-01-01T00:00:00Z") };

  it("getCompareTotals totals both windows, counts upsells by added_at and scopes to the org", async () => {
    const rows = await organizationOverviewRepository.getCompareTotals(
      orgA.id,
      { now: WINDOW_NOW, other: WINDOW_OTHER },
    );

    // Branch X £1000 + Branch Y £400 in January; orgB's £9999 is excluded.
    expect(rows.now).toMatchObject({ profit: 1400, bookings: 2 });
    expect(rows.other).toMatchObject({ profit: 0, bookings: 0 });
    expect(rows.now.quotedDeals).toBe(1);
  });

  it("getCompareTotals narrows to one branch", async () => {
    const rows = await organizationOverviewRepository.getCompareTotals(
      orgA.id,
      { now: WINDOW_NOW, other: WINDOW_OTHER },
      branchX.id,
    );
    expect(rows.now).toMatchObject({ profit: 1000, bookings: 1 });
  });

  it("getProfitSourceTotals groups month profit incl. upsells by deal lead source", async () => {
    const client = await makeClient({ orgId: orgA.id });
    const agent = await makeUser();
    const tx = await makeTransaction({
      user_id: agent.id, org_id: orgA.id, branch_id: branchX.id, client_id: client.id, lead_source: "FACEBOOK",
    });
    const b = await makeBooking({ transaction_id: tx.id, package_commission: "200", date_created: IN_MONTH });
    await makeBookingUpsell({ booking_id: b.id, commission: "50", added_at: IN_MONTH });

    const rows = await organizationOverviewRepository.getProfitSourceTotals(orgA.id, WINDOW_NOW.from, WINDOW_NOW.to);

    expect(rows.find((r) => r.source === "FACEBOOK")).toMatchObject({ profit: 250, bookings: 1 });
    expect(rows.find((r) => r.source === "SHOP")).toMatchObject({ profit: 1400, bookings: 2 });
  });

  it("getOpenDealCounts counts distinct open deals per agent", async () => {
    const counts = await organizationOverviewRepository.getOpenDealCounts(orgA.id);
    expect(Array.from(counts.values()).reduce((a, n) => a + n, 0)).toBe(1);
  });
});
