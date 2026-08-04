import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { bookingRepository } from "./booking.repository";
import { db } from "../../config/database";
import { booking_transfers, booking_accomodation, booking_flights } from "@shared/schema";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeTransaction,
  makeBooking, makeBoardBasis, makeBookingAccommodation,
} from "../../test/factories";

// Verifies the REAL scope SQL (buildTransactionRecordScopeConds) against Postgres —
// the part unit tests mock away. We seed two orgs, two branches, and several
// transactions, then assert which ones each role can "see" via transactionInScope.
// Record-level access is org-wide for staff roles (no branch pinning);
// homeworkers are confined to transactions they own.

function scope(over: Record<string, unknown>) {
  return { branchId: null, userId: null, orgRoles: [], ...over } as never;
}

let orgA: { id: string };
let orgB: { id: string };
let branchA1: { id: string };
let branchA2: { id: string };
let agentUser: { id: string };
let homeworkerUser: { id: string };
let txnA1: { id: string }; // orgA, branchA1, owned by agentUser
let txnA2: { id: string }; // orgA, branchA2
let txnHome: { id: string }; // orgA, branchA1, owned by homeworkerUser
let txnB: { id: string }; // orgB

beforeEach(async () => {
  await truncateAll();

  orgA = await makeOrg();
  orgB = await makeOrg();
  branchA1 = await makeBranch(orgA.id);
  branchA2 = await makeBranch(orgA.id);
  agentUser = await makeUser();
  homeworkerUser = await makeUser({ role: "homeworker" });

  txnA1 = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA1.id });
  txnA2 = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA2.id });
  txnHome = await makeTransaction({ user_id: homeworkerUser.id, org_id: orgA.id, branch_id: branchA1.id });
  txnB = await makeTransaction({ user_id: agentUser.id, org_id: orgB.id, branch_id: null });
});

describe("bookingRepository.transactionInScope — org_admin (org-wide)", () => {
  it("sees every transaction in its own org", async () => {
    const s = scope({ orgId: orgA.id, orgRole: "org_admin" });
    expect(await bookingRepository.transactionInScope(txnA1.id, s)).toBe(true);
    expect(await bookingRepository.transactionInScope(txnA2.id, s)).toBe(true);
  });

  it("cannot see another org's transaction", async () => {
    const s = scope({ orgId: orgA.id, orgRole: "org_admin" });
    expect(await bookingRepository.transactionInScope(txnB.id, s)).toBe(false);
  });
});

describe("bookingRepository.transactionInScope — agent (org-wide record access)", () => {
  it("sees transactions across branches within its org, but not other orgs", async () => {
    const s = scope({ orgId: orgA.id, orgRole: "agent", branchId: branchA1.id });
    expect(await bookingRepository.transactionInScope(txnA1.id, s)).toBe(true);
    expect(await bookingRepository.transactionInScope(txnA2.id, s)).toBe(true); // other branch, same org
    expect(await bookingRepository.transactionInScope(txnB.id, s)).toBe(false); // other org
  });
});

describe("bookingRepository.transactionInScope — homeworker (own transactions)", () => {
  it("sees only transactions it owns", async () => {
    const s = scope({ orgId: orgA.id, orgRole: "homeworker", userId: homeworkerUser.id });
    expect(await bookingRepository.transactionInScope(txnHome.id, s)).toBe(true);
    expect(await bookingRepository.transactionInScope(txnA1.id, s)).toBe(false); // owned by agentUser
  });
});

describe("bookingRepository.transactionInScope — platform_admin & trusted", () => {
  it("platform_admin crosses org boundaries", async () => {
    const s = scope({ orgId: orgA.id, orgRole: "platform_admin" });
    expect(await bookingRepository.transactionInScope(txnB.id, s)).toBe(true);
  });

  it("a trusted internal caller ({ orgId: null }) is unrestricted", async () => {
    expect(await bookingRepository.transactionInScope(txnB.id, { orgId: null })).toBe(true);
  });
});

describe("bookingRepository.findByTransactionId", () => {
  it("returns undefined when no booking exists for the transaction", async () => {
    expect(await bookingRepository.findByTransactionId(txnA1.id)).toBeUndefined();
  });

  it("returns the booking once one exists for the transaction", async () => {
    const b = await makeBooking({ transaction_id: txnA1.id });

    const found = await bookingRepository.findByTransactionId(txnA1.id);
    expect(found?.id).toBe(b.id);
  });
});

describe("bookingRepository.bookingInScope — booking joined through its transaction", () => {
  it("an agent sees bookings anywhere in its org but not another org", async () => {
    const inBranch = await makeBooking({ transaction_id: txnA1.id }); // branchA1
    const otherBranch = await makeBooking({ transaction_id: txnA2.id }); // branchA2
    const otherOrg = await makeBooking({ transaction_id: txnB.id }); // orgB

    const s = scope({ orgId: orgA.id, orgRole: "agent", branchId: branchA1.id });
    expect(await bookingRepository.bookingInScope(inBranch.id, s)).toBe(true);
    expect(await bookingRepository.bookingInScope(otherBranch.id, s)).toBe(true);
    expect(await bookingRepository.bookingInScope(otherOrg.id, s)).toBe(false);
  });
});

describe("bookingRepository.findWithDetails — joins & child aggregation", () => {
  it("returns the booking with its holiday_type_name and seeded accommodation", async () => {
    const b = await makeBooking({ transaction_id: txnA1.id, title: "Maldives Getaway" });
    const board = await makeBoardBasis({ type: "Half Board" });
    await makeBookingAccommodation({
      booking_id: b.id,
      is_primary: true,
      room_type: "Double",
      board_basis_id: board.id,
    });

    const details = await bookingRepository.findWithDetails(b.id);

    expect(details).toBeDefined();
    expect(details!.title).toBe("Maldives Getaway");
    // holiday_type_name resolved via the package_type left join
    expect(details!.holiday_type_name).toBe("Package");
    // the child accommodation comes back with its board_basis name joined in
    expect(details!.accommodations).toHaveLength(1);
    expect(details!.accommodations[0]).toMatchObject({ room_type: "Double", board_basis_name: "Half Board" });
    // empty child collections are arrays, not null
    expect(details!.flights).toEqual([]);
  });

  it("returns undefined for an unknown booking id", async () => {
    expect(await bookingRepository.findWithDetails("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });
});

describe("bookingRepository.replaceTransfers — full replace", () => {
  it("deletes the old transfers and inserts the new set", async () => {
    const b = await makeBooking({ transaction_id: txnA1.id });
    await bookingRepository.replaceTransfers(b.id, [{ booking_ref: "T1" }, { booking_ref: "T2" }]);

    await bookingRepository.replaceTransfers(b.id, [{ booking_ref: "T3" }]);

    const rows = await db.select().from(booking_transfers).where(eq(booking_transfers.booking_id, b.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].booking_ref).toBe("T3");
  });
});

describe("bookingRepository.replaceExtraAccommodations — preserves the primary", () => {
  it("replaces non-primary accommodations but leaves the primary untouched", async () => {
    const b = await makeBooking({ transaction_id: txnA1.id });
    await makeBookingAccommodation({ booking_id: b.id, is_primary: true, room_type: "PrimaryRoom" });
    await makeBookingAccommodation({ booking_id: b.id, is_primary: false, room_type: "OldExtra" });

    await bookingRepository.replaceExtraAccommodations(b.id, [{ room_type: "NewExtra" }]);

    const rows = await db.select().from(booking_accomodation).where(eq(booking_accomodation.booking_id, b.id));
    const byRoom = rows.map((r) => r.room_type).sort();
    // primary survives, old extra gone, new extra present
    expect(byRoom).toEqual(["NewExtra", "PrimaryRoom"]);
    expect(rows.find((r) => r.room_type === "PrimaryRoom")!.is_primary).toBe(true);
    expect(rows.find((r) => r.room_type === "NewExtra")!.is_primary).toBe(false);
  });
});

describe("bookingRepository.upsertPrimaryAccommodation — insert then update", () => {
  it("inserts a primary when none exists, then updates it in place", async () => {
    const b = await makeBooking({ transaction_id: txnA1.id });

    await bookingRepository.upsertPrimaryAccommodation(b.id, { room_type: "R1" });
    await bookingRepository.upsertPrimaryAccommodation(b.id, { room_type: "R2" });

    const rows = await db.select().from(booking_accomodation).where(eq(booking_accomodation.booking_id, b.id));
    expect(rows).toHaveLength(1); // updated in place, not duplicated
    expect(rows[0]).toMatchObject({ room_type: "R2", is_primary: true });
  });
});

describe("bookingRepository.upsertFlightByType — keyed by flight_type", () => {
  it("updates the same-type flight and inserts a different type", async () => {
    const b = await makeBooking({ transaction_id: txnA1.id });

    await bookingRepository.upsertFlightByType(b.id, "outbound", { flight_number: "BA1" });
    await bookingRepository.upsertFlightByType(b.id, "outbound", { flight_number: "BA2" }); // updates
    await bookingRepository.upsertFlightByType(b.id, "inbound", { flight_number: "BA3" }); // inserts

    const rows = await db.select().from(booking_flights).where(eq(booking_flights.booking_id, b.id));
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.flight_type === "outbound")!.flight_number).toBe("BA2");
    expect(rows.find((r) => r.flight_type === "inbound")!.flight_number).toBe("BA3");
  });
});
