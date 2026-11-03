import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { branchOverviewRepository, getBranchOverviewWindows } from "./branch-overview.repository";
import { resetCapture, renderWhere, whereCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const BM: Scope = {
  orgId: "org1", branchId: null, orgRole: "branch_manager", orgRoles: ["branch_manager"],
  userId: "u1", branchType: null, ownsHomeworkerBranch: false,
};

beforeEach(() => resetCapture());

describe("branchOverviewRepository.getStats partition", () => {
  it("adds the homeworker-branch exclusion when given a partitionScope", async () => {
    await branchOverviewRepository.getStats({ orgId: "org1", branchId: null, partitionScope: BM }).catch(() => undefined);
    const texts = whereCalls.map((_, i) => renderWhere(i).text);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.includes('"transaction"."branch_id" NOT IN (SELECT'))).toBe(true);
  });

  it("adds none for an org_admin", async () => {
    await branchOverviewRepository
      .getStats({ orgId: "org1", branchId: null, partitionScope: { ...BM, orgRole: "org_admin", orgRoles: ["org_admin"] } })
      .catch(() => undefined);
    expect(whereCalls.map((_, i) => renderWhere(i).text).some((t) => t.includes("NOT IN (SELECT"))).toBe(false);
  });
});

// Today / Week / Month are UK (Europe/London) days. These cases are written by hand
// and must hold whatever zone the server or the test machine runs in.
describe("getBranchOverviewWindows (UK days)", () => {
  const iso = (d: Date) => d.toISOString();

  it("summer: 23:30 UK on 1 Jul is still 1 Jul, 00:30 UK on 2 Jul is the next day", () => {
    // 22:30Z = 23:30 BST on 1 Jul; 23:30Z = 00:30 BST on 2 Jul.
    const before = getBranchOverviewWindows(new Date("2026-07-01T22:30:00Z"));
    const after = getBranchOverviewWindows(new Date("2026-07-01T23:30:00Z"));
    expect(iso(before.todayStart)).toBe("2026-06-30T23:00:00.000Z");
    expect(iso(after.todayStart)).toBe("2026-07-01T23:00:00.000Z");
  });

  it("winter: the day starts at midnight UTC", () => {
    const before = getBranchOverviewWindows(new Date("2026-01-15T23:30:00Z"));
    const after = getBranchOverviewWindows(new Date("2026-01-16T00:30:00Z"));
    expect(iso(before.todayStart)).toBe("2026-01-15T00:00:00.000Z");
    expect(iso(after.todayStart)).toBe("2026-01-16T00:00:00.000Z");
  });

  it("the week starts on the UK Monday and the month on the UK 1st", () => {
    // Wednesday 1 Jul 2026, 23:30 BST.
    const w = getBranchOverviewWindows(new Date("2026-07-01T22:30:00Z"));
    expect(iso(w.weekStart)).toBe("2026-06-28T23:00:00.000Z"); // Mon 29 Jun 00:00 BST
    expect(iso(w.monthStart)).toBe("2026-06-30T23:00:00.000Z"); // Wed 1 Jul 00:00 BST
    expect(iso(w.monthEnd)).toBe("2026-07-31T23:00:00.000Z"); // Sat 1 Aug 00:00 BST
  });

  it("the month rolls over at UK midnight, not UTC midnight", () => {
    // 23:30Z on 31 Jul is already 00:30 BST on 1 Aug.
    const w = getBranchOverviewWindows(new Date("2026-07-31T23:30:00Z"));
    expect(iso(w.monthStart)).toBe("2026-07-31T23:00:00.000Z");
    expect(iso(w.monthEnd)).toBe("2026-08-31T23:00:00.000Z");
  });

  it("day offsets stay on UK midnights across the October clock change", () => {
    // 27 Oct 2026 is the first day after the clocks go back (25 Oct 2026).
    const w = getBranchOverviewWindows(new Date("2026-10-23T12:00:00Z"));
    expect(iso(w.todayStart)).toBe("2026-10-22T23:00:00.000Z");
    expect(iso(w.in7Days)).toBe("2026-10-30T00:00:00.000Z");
  });
});
