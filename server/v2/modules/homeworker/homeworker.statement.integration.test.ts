import { describe, it, expect, beforeEach } from "vitest";
import { homeworkerRepository } from "./homeworker.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeTransaction, makeClient,
  makeBooking, makeBookingAccommodation, makeBookingUpsell,
} from "../../test/factories";

// Verifies the REAL statement SQL against Postgres. Period gross = (a) the net of
// bookings created in the period (stored sales commission incl. line items -
// discounts - service charge) + (b) commission of active upsells whose own added_at
// is in the period, on ANY booking of the branch (the booking's creation month does
// not matter). Clamped at zero; the homeworker gets ROUND(gross * pct / 100, 2),
// the org keeps the remainder.
// Written for the integration config (npm run test:integration); not part of `npm test`.

let org: { id: string };
let hwBranch: { id: string };
let otherHwBranch: { id: string };
let hwUser: { id: string };

async function seedBooking(opts: {
  branchId?: string;
  isTest?: boolean;
  txnActive?: boolean;
  bookingActive?: boolean;
  created: string;
  packageCommission?: string;
  discounts?: string;
  serviceCharge?: string;
  clientId?: string;
}) {
  const txn = await makeTransaction({
    user_id: hwUser.id,
    org_id: org.id,
    branch_id: opts.branchId ?? hwBranch.id,
    is_test: opts.isTest ?? false,
    is_active: opts.txnActive ?? true,
    client_id: opts.clientId,
  });
  return makeBooking({
    transaction_id: txn.id,
    package_commission: opts.packageCommission ?? "0",
    discounts: opts.discounts,
    service_charge: opts.serviceCharge,
    is_active: opts.bookingActive ?? true,
    date_created: new Date(`${opts.created}T12:00:00Z`),
  });
}

beforeEach(async () => {
  await truncateAll();
  org = await makeOrg();
  hwUser = await makeUser({ role: "homeworker" });
  hwBranch = await makeBranch(org.id, {
    name: "Jo",
    branchType: "homeworker",
    ownerUserId: hwUser.id,
    profitSharePercent: "70.00",
  });
  const otherUser = await makeUser();
  otherHwBranch = await makeBranch(org.id, {
    name: "Other",
    branchType: "homeworker",
    ownerUserId: otherUser.id,
    profitSharePercent: "50.00",
  });
});

describe("homeworkerRepository statement (March 2026 period)", () => {
  const FROM = "2026-03-01";
  const TO = "2026-04-01";

  async function seedMarch() {
    const client = await makeClient({ firstName: "Ada", surename: "Lovelace" });

    // B1: 100 package + 20 line item - 10 discount - 5 service charge = 105
    const b1 = await seedBooking({
      created: "2026-03-10", packageCommission: "100.00", discounts: "10.00", serviceCharge: "5.00", clientId: client.id,
    });
    await makeBookingAccommodation({ booking_id: b1.id, commission: "20.00" });

    // B2: 50 package. Its upsells are separate rows: 30 added in March counts, 99 added in April does not.
    const b2 = await seedBooking({ created: "2026-03-20", packageCommission: "50.00" });
    await makeBookingUpsell({ booking_id: b2.id, commission: "30.00", added_at: new Date("2026-03-15T09:00:00Z") });
    await makeBookingUpsell({ booking_id: b2.id, commission: "99.00", added_at: new Date("2026-04-02T09:00:00Z") });

    // An EARLIER-month booking (excluded itself) whose upsell was added in March: counts in March.
    const feb = await seedBooking({ created: "2026-02-10", packageCommission: "500.00" });
    await makeBookingUpsell({ booking_id: feb.id, commission: "40.00", added_at: new Date("2026-03-05T09:00:00Z") });
    // ...and an inactive upsell on it must not count.
    await makeBookingUpsell({ booking_id: feb.id, commission: "77.00", added_at: new Date("2026-03-06T09:00:00Z"), is_active: false });

    // Upsells on excluded bookings never count: other branch, test transaction, inactive booking.
    const otherBk = await seedBooking({ created: "2026-03-13", packageCommission: "1.00", branchId: otherHwBranch.id });
    await makeBookingUpsell({ booking_id: otherBk.id, commission: "500.00", added_at: new Date("2026-03-14T09:00:00Z") });
    const testBk = await seedBooking({ created: "2026-03-13", packageCommission: "1.00", isTest: true });
    await makeBookingUpsell({ booking_id: testBk.id, commission: "500.00", added_at: new Date("2026-03-14T09:00:00Z") });
    const inactiveBk = await seedBooking({ created: "2026-03-13", packageCommission: "1.00", bookingActive: false });
    await makeBookingUpsell({ booking_id: inactiveBk.id, commission: "500.00", added_at: new Date("2026-03-14T09:00:00Z") });

    // Excluded: test transaction, inactive transaction, inactive booking, other month, other homeworker's branch.
    await seedBooking({ created: "2026-03-11", packageCommission: "1000.00", isTest: true });
    await seedBooking({ created: "2026-03-11", packageCommission: "1000.00", txnActive: false });
    await seedBooking({ created: "2026-03-12", packageCommission: "1000.00", bookingActive: false });
    await seedBooking({ created: "2026-02-28", packageCommission: "500.00" });
    await seedBooking({ created: "2026-04-01", packageCommission: "500.00" }); // end bound is exclusive
    await seedBooking({ created: "2026-03-13", packageCommission: "500.00", branchId: otherHwBranch.id });
  }

  it("sums booking nets (a) plus upsells recognised in the period (b) over qualifying rows only", async () => {
    await seedMarch();

    const totals = await homeworkerRepository.getStatementTotals(org.id, hwBranch.id, FROM, TO, "70.00");

    // a: 105 + 50 = 155; b: 30 (B2 upsell) + 40 (February booking's upsell) = 70
    expect(totals.bookingCount).toBe(2);
    expect(totals.gross).toBe("225.00");
    expect(totals.homeworkerShare).toBe("157.50");
    expect(totals.orgShare).toBe("67.50");
  });

  it("returns booking lines and separate upsell lines that add up to the gross", async () => {
    await seedMarch();

    const bookings = await homeworkerRepository.getStatementLines(org.id, hwBranch.id, FROM, TO);
    const upsells = await homeworkerRepository.getStatementUpsellLines(org.id, hwBranch.id, FROM, TO);

    expect(bookings).toHaveLength(2);
    expect(bookings[0]).toMatchObject({
      clientName: "Ada Lovelace", commission: "120.00", discounts: "10.00", serviceCharge: "5.00", net: "105.00",
    });
    expect(bookings[1]).toMatchObject({ commission: "50.00", discounts: "0.00", serviceCharge: "0.00", net: "50.00" });
    // Oldest added_at first: the February booking's upsell (Mar 5) then B2's (Mar 15).
    expect(upsells.map((u) => u.amount)).toEqual(["40.00", "30.00"]);
  });

  it("does not count an upsell added outside the period, even on a booking created inside it", async () => {
    await seedMarch();

    const april = await homeworkerRepository.getStatementUpsellLines(org.id, hwBranch.id, "2026-04-01", "2026-05-01");

    expect(april.map((u) => u.amount)).toEqual(["99.00"]);
  });

  it("is scoped to the org: the same branch id under another org yields nothing", async () => {
    await seedMarch();
    const otherOrg = await makeOrg();

    const totals = await homeworkerRepository.getStatementTotals(otherOrg.id, hwBranch.id, FROM, TO, "70.00");

    expect(totals).toMatchObject({ gross: "0.00", bookingCount: 0 });
    expect(await homeworkerRepository.getStatementUpsellLines(otherOrg.id, hwBranch.id, FROM, TO)).toEqual([]);
  });
});

describe("homeworkerRepository statement (rounding and clamping)", () => {
  it("splits 70/30 with the org taking the rounding remainder so the shares add up to gross", async () => {
    await seedBooking({ created: "2026-04-10", packageCommission: "33.33" });

    const totals = await homeworkerRepository.getStatementTotals(org.id, hwBranch.id, "2026-04-01", "2026-05-01", "70.00");

    expect(totals.gross).toBe("33.33");
    expect(totals.homeworkerShare).toBe("23.33"); // 23.331 rounded
    expect(totals.orgShare).toBe("10.00");
  });

  it("clamps a negative period to zero (nothing carries forward)", async () => {
    await seedBooking({ created: "2026-05-10", packageCommission: "10.00", discounts: "50.00" });

    const totals = await homeworkerRepository.getStatementTotals(org.id, hwBranch.id, "2026-05-01", "2026-06-01", "70.00");
    const lines = await homeworkerRepository.getStatementLines(org.id, hwBranch.id, "2026-05-01", "2026-06-01");

    expect(totals).toMatchObject({ gross: "0.00", homeworkerShare: "0.00", orgShare: "0.00", bookingCount: 1 });
    expect(lines[0].net).toBe("-40.00"); // the line still shows the real figure
  });

  it("clamps the SUM, not each booking: a loss offsets a profit in the same period", async () => {
    await seedBooking({ created: "2026-06-05", packageCommission: "100.00" });
    await seedBooking({ created: "2026-06-06", packageCommission: "10.00", discounts: "40.00" });

    const totals = await homeworkerRepository.getStatementTotals(org.id, hwBranch.id, "2026-06-01", "2026-07-01", "70.00");

    expect(totals.gross).toBe("70.00");
    expect(totals.homeworkerShare).toBe("49.00");
    expect(totals.orgShare).toBe("21.00");
  });
});

describe("homeworkerRepository.insertStatement", () => {
  function record() {
    return {
      orgId: org.id,
      branchId: hwBranch.id,
      userId: hwUser.id,
      periodStart: "2026-03-01",
      periodEnd: "2026-04-01",
      periodEndInclusive: "2026-03-31",
      grossProfit: "225.00",
      sharePercent: "70.00",
      homeworkerShare: "157.50",
      orgShare: "67.50",
      finalisedBy: hwUser.id,
      auditName: null,
    };
  }

  it("stores one final statement per (branch, period start) and reports a duplicate", async () => {
    const created = await homeworkerRepository.insertStatement(record());
    expect(created.status).toBe("created");
    if (created.status !== "created") return;
    expect(created.row).toMatchObject({ status: "final", grossProfit: "225.00", homeworkerShare: "157.50" });
    expect(await homeworkerRepository.findStatement(hwBranch.id, "2026-03-01", "2026-04-01")).toMatchObject({ id: created.row.id });
    // A different end for the same start is not "the same period".
    expect(await homeworkerRepository.findStatement(hwBranch.id, "2026-03-01", "2026-03-15")).toBeNull();

    await expect(homeworkerRepository.insertStatement(record())).resolves.toEqual({ status: "duplicate" });
  });

  it("finds overlapping statements but not adjacent months", async () => {
    await homeworkerRepository.insertStatement(record());

    expect(await homeworkerRepository.findOverlappingStatement(hwBranch.id, "2026-03-15", "2026-04-15")).not.toBeNull();
    expect(await homeworkerRepository.findOverlappingStatement(hwBranch.id, "2026-02-01", "2026-03-01")).toBeNull();
    expect(await homeworkerRepository.findOverlappingStatement(hwBranch.id, "2026-04-01", "2026-05-01")).toBeNull();
  });
});
