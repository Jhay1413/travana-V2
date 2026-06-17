import { describe, it, expect, beforeEach } from "vitest";
import { reportsRepository } from "./reports.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeTransaction, makeBooking,
} from "../../test/factories";

let orgA: { id: string };
let branchA1: { id: string };
let branchA2: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  branchA1 = await makeBranch(orgA.id);
  branchA2 = await makeBranch(orgA.id);
  const agent = await makeUser();
  const clientA1 = await makeClient({ orgId: orgA.id });
  const clientA2 = await makeClient({ orgId: orgA.id });
  const clientOther = await makeClient({ orgId: orgA.id });

  // booking has a UNIQUE(transaction_id) — one booking per transaction, so each
  // seeded booking gets its own transaction.
  const t1 = await makeTransaction({ user_id: agent.id, org_id: orgA.id, branch_id: branchA1.id, client_id: clientA1.id, lead_source: "SHOP" });
  const t2 = await makeTransaction({ user_id: agent.id, org_id: orgA.id, branch_id: branchA1.id, client_id: clientA2.id, lead_source: "FACEBOOK" });
  const t3 = await makeTransaction({ user_id: agent.id, org_id: orgA.id, branch_id: branchA2.id, client_id: clientOther.id, lead_source: "SHOP" });
  const t4 = await makeTransaction({ user_id: agent.id, org_id: orgA.id, branch_id: branchA1.id, client_id: clientA1.id, lead_source: "SHOP" });

  // In-range, branchA1: Jan (£500, SHOP) + Feb (£300, FACEBOOK)
  await makeBooking({ transaction_id: t1.id, travel_date: "2026-06-01", package_commission: "500", date_created: new Date("2026-01-15T12:00:00Z") });
  await makeBooking({ transaction_id: t2.id, travel_date: "2026-06-01", package_commission: "300", date_created: new Date("2026-02-10T12:00:00Z") });
  // Excluded: other branch
  await makeBooking({ transaction_id: t3.id, travel_date: "2026-06-01", package_commission: "999", date_created: new Date("2026-01-20T12:00:00Z") });
  // Excluded: out of date range (June)
  await makeBooking({ transaction_id: t4.id, travel_date: "2026-06-01", package_commission: "100", date_created: new Date("2026-06-05T12:00:00Z") });
});

function branchScope() {
  // Local date parts: fillMonthBuckets reads from/to with local getMonth()/
  // getFullYear(), so a UTC 'Z' midnight could roll into the previous month.
  return {
    orgId: orgA.id,
    branchId: branchA1.id,
    from: new Date(2026, 0, 1, 0, 0, 0),
    to: new Date(2026, 2, 31, 23, 59, 59),
  } as never;
}

describe("reportsRepository.getSales — totals", () => {
  it("sums commission and counts bookings/distinct clients within branch + date range", async () => {
    const report = await reportsRepository.getSales(branchScope());

    expect(report.totals.bookings).toBe(2); // Jan + Feb, branchA1
    expect(report.totals.commission).toBe(800); // 500 + 300 (other branch 999 & June 100 excluded)
    expect(report.totals.distinctClients).toBe(2);
    expect(report.totals.avgCommission).toBe(400);
  });

  it("reports an empty prior period (nothing before the range)", async () => {
    const report = await reportsRepository.getSales(branchScope());
    expect(report.prior.bookings).toBe(0);
    expect(report.prior.commission).toBe(0);
  });
});

describe("reportsRepository.getSales — month buckets", () => {
  it("returns one contiguous bucket per month, zero-filling empty months", async () => {
    const report = await reportsRepository.getSales(branchScope());

    // Jan, Feb, Mar — March has no bookings but must still appear.
    expect(report.byMonth.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(report.byMonth.find((m) => m.month === "2026-01")).toMatchObject({ commission: 500, bookings: 1 });
    expect(report.byMonth.find((m) => m.month === "2026-02")).toMatchObject({ commission: 300, bookings: 1 });
    expect(report.byMonth.find((m) => m.month === "2026-03")).toMatchObject({ commission: 0, bookings: 0 });
  });
});

describe("reportsRepository.getSales — by lead source", () => {
  it("groups commission by lead source, ordered by commission descending", async () => {
    const report = await reportsRepository.getSales(branchScope());

    expect(report.byLeadSource.map((r) => r.source)).toEqual(["SHOP", "FACEBOOK"]);
    expect(report.byLeadSource[0]).toMatchObject({ source: "SHOP", commission: 500, bookings: 1 });
    expect(report.byLeadSource[1]).toMatchObject({ source: "FACEBOOK", commission: 300, bookings: 1 });
  });
});
