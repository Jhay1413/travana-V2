// Needs a live Postgres: run with `npm run test:integration`. Written, not run by `npm test`.
import { describe, it, expect, beforeEach } from "vitest";
import { departuresRepository } from "./departures.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeTransaction, makeBooking,
} from "../../test/factories";

let orgA: { id: string };
let orgB: { id: string };
let branchX: { id: string };
let branchY: { id: string };
let ann: { id: string };
let live: { id: string };

async function deal(orgId: string, branchId: string, travelDate: string, status: "BOOKED" | "LOST" = "BOOKED") {
  const client = await makeClient({ orgId });
  const txn = await makeTransaction({ user_id: ann.id, org_id: orgId, branch_id: branchId, client_id: client.id });
  return makeBooking({ transaction_id: txn.id, travel_date: travelDate, booking_status: status });
}

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
  branchX = await makeBranch(orgA.id, { name: "X" });
  branchY = await makeBranch(orgA.id, { name: "Y" });
  const branchZ = await makeBranch(orgB.id, { name: "Z" });
  ann = await makeUser();

  live = await deal(orgA.id, branchX.id, "2026-10-22");
  await deal(orgA.id, branchX.id, "2026-10-21", "LOST");
  await deal(orgA.id, branchX.id, "2026-10-10");
  await deal(orgA.id, branchY.id, "2026-10-23");
  await deal(orgB.id, branchZ.id, "2026-10-22");
});

describe("departuresRepository (integration)", () => {
  it("lists the organisation, never LOST or other organisations, from the lower bound", async () => {
    const rows = await departuresRepository.listRows({ orgId: orgA.id, branchId: null, fromYmd: "2026-10-20", toExclYmd: null });
    expect(rows.map((r) => r.travelDate)).toEqual(["2026-10-22", "2026-10-23"]);
  });

  it("a branch filter keeps only that branch", async () => {
    const rows = await departuresRepository.listRows({ orgId: orgA.id, branchId: branchY.id, fromYmd: null, toExclYmd: null });
    expect(rows.map((r) => r.travelDate)).toEqual(["2026-10-23"]);
  });

  it("the upper bound is exclusive", async () => {
    const rows = await departuresRepository.listRows({ orgId: orgA.id, branchId: null, fromYmd: "2026-10-20", toExclYmd: "2026-10-23" });
    expect(rows.map((r) => r.travelDate)).toEqual(["2026-10-22"]);
  });

  it("the first tick creates the row, later ticks change only their own column", async () => {
    const at = new Date("2026-10-20T10:00:00Z");
    await departuresRepository.upsertCheck(orgA.id, live.id, { checkIn: true }, { by: ann.id, byName: "Ann", at, what: "Check in" });
    const second = await departuresRepository.upsertCheck(orgA.id, live.id, { fullyPaid: true }, { by: ann.id, byName: "Ann", at, what: "Fully paid" });
    expect(second).toMatchObject({ checkIn: true, fullyPaid: true, lastChangeWhat: "Fully paid" });

    const row = await departuresRepository.findRow({ orgId: orgA.id, branchId: null, fromYmd: null, toExclYmd: null, bookingId: live.id });
    expect(row).toMatchObject({ checkIn: true, fullyPaid: true, passportInfo: false });
  });

  it("findRow is null for another organisation", async () => {
    const row = await departuresRepository.findRow({ orgId: orgB.id, branchId: null, fromYmd: null, toExclYmd: null, bookingId: live.id });
    expect(row).toBeNull();
  });
});
