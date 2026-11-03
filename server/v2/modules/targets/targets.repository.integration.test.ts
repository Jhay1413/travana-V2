import { describe, it, expect, beforeEach } from "vitest";
import * as targetsRepository from "./targets.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeTransaction, makeBooking, makeBookingUpsell,
} from "../../test/factories";

// DB-backed: written but only runs when the test database is available.
let orgA: { id: string };
let orgB: { id: string };
let branchX: { id: string };
let branchY: { id: string };
let branchB: { id: string };
let agent1: { id: string };
let agent2: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
  branchX = await makeBranch(orgA.id, { name: "X" });
  branchY = await makeBranch(orgA.id, { name: "Y" });
  branchB = await makeBranch(orgB.id, { name: "Foreign" });
  agent1 = await makeUser();
  agent2 = await makeUser();
});

async function seedBooking(opts: {
  branchId: string; orgId: string; userId: string; commission: string; created: string;
  isTest?: boolean; txnActive?: boolean; bookingActive?: boolean;
}) {
  const client = await makeClient({ orgId: opts.orgId });
  const txn = await makeTransaction({
    user_id: opts.userId, org_id: opts.orgId, branch_id: opts.branchId, client_id: client.id,
    is_test: opts.isTest ?? false, is_active: opts.txnActive ?? true,
  });
  return makeBooking({
    transaction_id: txn.id,
    package_commission: opts.commission,
    date_created: new Date(opts.created),
    is_active: opts.bookingActive ?? true,
  });
}

describe("targetsRepository.getActualsForYear", () => {
  it("sums commission per branch / agent / London month, including upsells by added_at", async () => {
    const b = await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "100", created: "2026-03-10T12:00:00Z" });
    await makeBookingUpsell({ booking_id: b.id, commission: "40", added_at: new Date("2026-04-02T12:00:00Z") });
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent2.id, commission: "70", created: "2026-03-20T12:00:00Z" });

    const rows = await targetsRepository.getActualsForYear(orgA.id, 2026);
    const get = (u: string, m: number) => rows.find((r) => r.userId === u && r.month === m)?.amount ?? 0;

    expect(get(agent1.id, 3)).toBe(100);
    expect(get(agent1.id, 4)).toBe(40); // upsell lands in the month it was added
    expect(get(agent2.id, 3)).toBe(70);
  });

  it("buckets by the London month: 23:30 UTC on 30 June is July (BST)", async () => {
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "50", created: "2026-06-30T23:30:00Z" });

    const rows = await targetsRepository.getActualsForYear(orgA.id, 2026);

    expect(rows.find((r) => r.month === 7)?.amount).toBe(50);
    expect(rows.find((r) => r.month === 6)).toBeUndefined();
  });

  it("keeps a late-December booking in its London year and excludes the next year's", async () => {
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "10", created: "2026-12-31T23:30:00Z" });
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "20", created: "2027-01-01T00:30:00Z" });

    const rows = await targetsRepository.getActualsForYear(orgA.id, 2026);

    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(10);
  });

  it("excludes test transactions, inactive transactions and inactive bookings", async () => {
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "1", created: "2026-03-10T12:00:00Z", isTest: true });
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "2", created: "2026-03-10T12:00:00Z", txnActive: false });
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "4", created: "2026-03-10T12:00:00Z", bookingActive: false });
    const inactiveUpsellBooking = await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "8", created: "2026-03-10T12:00:00Z" });
    await makeBookingUpsell({ booking_id: inactiveUpsellBooking.id, commission: "100", added_at: new Date("2026-03-11T12:00:00Z"), is_active: false });

    const rows = await targetsRepository.getActualsForYear(orgA.id, 2026);

    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(8);
  });

  it("never leaks another organisation's branches, and honours branch/user filters", async () => {
    await seedBooking({ branchId: branchX.id, orgId: orgA.id, userId: agent1.id, commission: "100", created: "2026-03-10T12:00:00Z" });
    await seedBooking({ branchId: branchY.id, orgId: orgA.id, userId: agent2.id, commission: "30", created: "2026-03-10T12:00:00Z" });
    await seedBooking({ branchId: branchB.id, orgId: orgB.id, userId: agent1.id, commission: "999", created: "2026-03-10T12:00:00Z" });

    const all = await targetsRepository.getActualsForYear(orgA.id, 2026);
    expect(all.reduce((s, r) => s + r.amount, 0)).toBe(130);

    const onlyX = await targetsRepository.getActualsForYear(orgA.id, 2026, { branchIds: [branchX.id] });
    expect(onlyX.reduce((s, r) => s + r.amount, 0)).toBe(100);

    const onlyAgent2 = await targetsRepository.getActualsForYear(orgA.id, 2026, { userId: agent2.id });
    expect(onlyAgent2.reduce((s, r) => s + r.amount, 0)).toBe(30);

    expect(await targetsRepository.getActualsForYear(orgA.id, 2026, { branchIds: [] })).toEqual([]);
  });
});

describe("targetsRepository writes", () => {
  it("upserts org and shop targets for all 12 months and stays unique per month", async () => {
    await targetsRepository.upsertOrgTargets(await dbExec(), orgA.id, 2026, new Array<number>(12).fill(100));
    await targetsRepository.upsertOrgTargets(await dbExec(), orgA.id, 2026, new Array<number>(12).fill(250));

    const rows = await targetsRepository.getOrgTargetsForYear(orgA.id, 2026);
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => Number(r.amount) === 250)).toBe(true);
    expect(await targetsRepository.getOrgTargetsForYear(orgB.id, 2026)).toEqual([]);
  });

  it("rolls every write back when the transaction throws", async () => {
    await expect(
      targetsRepository.withTransaction(async (tx) => {
        await targetsRepository.upsertShopTargetMonths(tx, branchX.id, 2026, new Array<number>(12).fill(5));
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await targetsRepository.getShopTargetsForYear([branchX.id], 2026)).toEqual([]);
  });
});

async function dbExec() {
  const { db } = await import("../../config/database");
  return db;
}
