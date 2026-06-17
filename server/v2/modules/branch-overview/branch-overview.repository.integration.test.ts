import { describe, it, expect, beforeEach } from "vitest";
import { branchOverviewRepository } from "./branch-overview.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeClient, makeBranchMember,
  makeTransaction, makeBooking, makeQuote,
} from "../../test/factories";

const MONTH_START = new Date(2026, 0, 1); // Jan 2026
const MONTH_END = new Date(2026, 1, 1); // exclusive upper bound
const IN_MONTH = new Date("2026-01-15T12:00:00Z");

let orgA: { id: string };
let branchA1: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  branchA1 = await makeBranch(orgA.id);
  const client = await makeClient({ orgId: orgA.id });

  const alice = await makeUser({ firstName: "Alice" });
  const bob = await makeUser({ firstName: "Bob" });
  const mgr = await makeUser({ firstName: "Manager" });

  // Branch membership decides who is a "sales agent": only agents rank.
  await makeBranchMember({ orgId: orgA.id, branchId: branchA1.id, userId: alice.id, orgRole: "agent" });
  await makeBranchMember({ orgId: orgA.id, branchId: branchA1.id, userId: bob.id, orgRole: "agent" });
  await makeBranchMember({ orgId: orgA.id, branchId: branchA1.id, userId: mgr.id, orgRole: "branch_manager" });

  const txn = (userId: string) =>
    makeTransaction({ user_id: userId, org_id: orgA.id, branch_id: branchA1.id, client_id: client.id });

  // Each booking needs its own transaction (UNIQUE transaction_id).
  const tAliceB = await txn(alice.id);
  const tBobB = await txn(bob.id);
  const tMgrB = await txn(mgr.id);
  const tAliceQ = await txn(alice.id);
  const tBobQ = await txn(bob.id);

  await makeBooking({ transaction_id: tAliceB.id, travel_date: "2026-06-01", package_commission: "800", date_created: IN_MONTH });
  await makeBooking({ transaction_id: tBobB.id, travel_date: "2026-06-01", package_commission: "300", date_created: IN_MONTH });
  // Manager booking — should NOT surface on the leaderboard.
  await makeBooking({ transaction_id: tMgrB.id, travel_date: "2026-06-01", package_commission: "9999", date_created: IN_MONTH });

  await makeQuote({ transaction_id: tAliceQ.id, date_created: IN_MONTH });
  await makeQuote({ transaction_id: tBobQ.id, date_created: IN_MONTH });
});

describe("branchOverviewRepository.getTeamLeaderboard", () => {
  it("ranks only sales agents, by commission descending, with their booking & quote counts", async () => {
    const scope = { orgId: orgA.id, branchId: branchA1.id } as never;

    const rows = await branchOverviewRepository.getTeamLeaderboard(scope, MONTH_START, MONTH_END);

    // manager excluded despite a £9999 booking
    expect(rows.map((r) => r.name)).toEqual(["Alice", "Bob"]);
    expect(rows[0]).toMatchObject({ name: "Alice", bookings: 1, commission: 800, quotes: 1 });
    expect(rows[1]).toMatchObject({ name: "Bob", bookings: 1, commission: 300, quotes: 1 });
  });

  it("excludes activity outside the month window", async () => {
    const scope = { orgId: orgA.id, branchId: branchA1.id } as never;

    // A window in a different month yields zeroed agents (still listed, no activity).
    const rows = await branchOverviewRepository.getTeamLeaderboard(
      scope,
      new Date(2026, 5, 1),
      new Date(2026, 6, 1),
    );

    expect(rows.every((r) => r.bookings === 0 && r.quotes === 0 && r.commission === 0)).toBe(true);
  });
});

describe("branchOverviewRepository.branchBelongsToOrg", () => {
  it("is true for a branch in the org and false otherwise", async () => {
    const otherOrg = await makeOrg();
    expect(await branchOverviewRepository.branchBelongsToOrg(branchA1.id, orgA.id)).toBe(true);
    expect(await branchOverviewRepository.branchBelongsToOrg(branchA1.id, otherOrg.id)).toBe(false);
  });
});

describe("branchOverviewRepository.getBranchProfile", () => {
  it("returns the branch with its active member count", async () => {
    const profile = await branchOverviewRepository.getBranchProfile(branchA1.id);
    expect(profile).toBeDefined();
    expect(profile!.memberCount).toBe(3); // alice, bob, manager
  });

  it("returns null for a null branch id", async () => {
    expect(await branchOverviewRepository.getBranchProfile(null)).toBeNull();
  });
});
