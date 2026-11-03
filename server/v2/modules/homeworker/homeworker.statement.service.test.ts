import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./homeworker.repository", () => ({
  homeworkerRepository: {
    findHomeworkerBranch: vi.fn(),
    findByOwner: vi.fn(),
    getStatementTotals: vi.fn(),
    getStatementLines: vi.fn(),
    getStatementUpsellLines: vi.fn(),
    findStatement: vi.fn(),
    findOverlappingStatement: vi.fn(),
    insertStatement: vi.fn(),
  },
}));
vi.mock("../invite/invite-email.service", () => ({ newInviteCredentials: vi.fn(), sendInviteEmail: vi.fn() }));

import { homeworkerService, isCalendarMonth, resolveStatementPeriod } from "./homeworker.service";
import { homeworkerRepository } from "./homeworker.repository";

const ADMIN = { orgId: "o1", userId: "admin1", orgRole: "org_admin", orgRoles: ["org_admin"] };
const HW = { orgId: "o1", userId: "hw1", orgRole: "homeworker", orgRoles: ["homeworker"] };
const BRANCH = { id: "hb1", name: "Jo", ownerUserId: "hw1", profitSharePercent: "70.00", isActive: true };
const TOTALS = { gross: "100.00", homeworkerShare: "70.00", orgShare: "30.00", bookingCount: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue(BRANCH as never);
  vi.mocked(homeworkerRepository.getStatementTotals).mockResolvedValue(TOTALS);
  vi.mocked(homeworkerRepository.getStatementLines).mockResolvedValue([]);
  vi.mocked(homeworkerRepository.getStatementUpsellLines).mockResolvedValue([]);
  vi.mocked(homeworkerRepository.findStatement).mockResolvedValue(null);
  vi.mocked(homeworkerRepository.findOverlappingStatement).mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolveStatementPeriod", () => {
  it("defaults to the current calendar month when both bounds are omitted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T10:00:00Z"));

    expect(resolveStatementPeriod()).toEqual({ from: "2026-02-01", to: "2026-03-01" });
  });

  it("rolls the default over the year end", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:59:59Z"));

    expect(resolveStatementPeriod()).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });

  it("returns an explicit valid period unchanged", () => {
    expect(resolveStatementPeriod("2026-01-01", "2027-01-01")).toEqual({ from: "2026-01-01", to: "2027-01-01" });
  });

  it("400s when only one bound is given", () => {
    expect(() => resolveStatementPeriod("2026-01-01")).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => resolveStatementPeriod(undefined, "2026-01-01")).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it("400s when from is not before to", () => {
    expect(() => resolveStatementPeriod("2026-03-01", "2026-03-01")).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => resolveStatementPeriod("2026-04-01", "2026-03-01")).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it("400s when the range exceeds one year", () => {
    expect(() => resolveStatementPeriod("2026-01-01", "2027-01-03")).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it("400s on impossible or malformed dates", () => {
    expect(() => resolveStatementPeriod("2026-02-31", "2026-03-31")).toThrow(expect.objectContaining({ statusCode: 400 }));
    expect(() => resolveStatementPeriod("nope", "2026-03-31")).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});

describe("homeworkerService.getStatement", () => {
  it("returns the computed statement with the branch share and no finalised row", async () => {
    const result = await homeworkerService.getStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01");

    expect(homeworkerRepository.findHomeworkerBranch).toHaveBeenCalledWith("hb1", "o1");
    expect(homeworkerRepository.getStatementTotals).toHaveBeenCalledWith("o1", "hb1", "2026-03-01", "2026-04-01", "70.00");
    expect(result).toEqual({
      branch: { id: "hb1", name: "Jo", ownerUserId: "hw1", profitSharePercent: "70.00" },
      period: { from: "2026-03-01", to: "2026-04-01", periodEndInclusive: "2026-03-31" },
      gross: "100.00",
      liveGross: "100.00",
      driftWarning: false,
      sharePercent: "70.00",
      homeworkerShare: "70.00",
      orgShare: "30.00",
      bookingCount: 2,
      lines: [],
      finalised: null,
    });
  });

  const FROZEN = {
    id: "st1",
    status: "final",
    grossProfit: "100.00",
    sharePercent: "60.00",
    homeworkerShare: "60.00",
    orgShare: "40.00",
  };

  it("looks the finalised statement up by the exact period (start and end)", async () => {
    await homeworkerService.getStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01");

    expect(homeworkerRepository.findStatement).toHaveBeenCalledWith("hb1", "2026-03-01", "2026-04-01");
  });

  it("returns the FROZEN figures when finalised, with no drift when live gross is unchanged", async () => {
    vi.mocked(homeworkerRepository.findStatement).mockResolvedValue(FROZEN as never);

    const result = await homeworkerService.getStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01");

    expect(result.finalised).toMatchObject({ id: "st1" });
    // Frozen share (60) wins over the branch's current share (70) and the live shares.
    expect(result).toMatchObject({
      gross: "100.00", liveGross: "100.00", sharePercent: "60.00", homeworkerShare: "60.00", orgShare: "40.00", driftWarning: false,
    });
  });

  it("flags drift when the live gross differs from the frozen gross, still showing frozen figures", async () => {
    vi.mocked(homeworkerRepository.findStatement).mockResolvedValue(FROZEN as never);
    vi.mocked(homeworkerRepository.getStatementTotals).mockResolvedValue({ ...TOTALS, gross: "120.50", homeworkerShare: "84.35", orgShare: "36.15" });

    const result = await homeworkerService.getStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01");

    expect(result.driftWarning).toBe(true);
    expect(result.liveGross).toBe("120.50");
    expect(result.gross).toBe("100.00");
    expect(result.homeworkerShare).toBe("60.00");
  });

  it("never warns about drift when nothing is finalised", async () => {
    vi.mocked(homeworkerRepository.getStatementTotals).mockResolvedValue({ ...TOTALS, gross: "999.00" });

    const result = await homeworkerService.getStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01");

    expect(result.driftWarning).toBe(false);
    expect(result.gross).toBe("999.00");
  });

  it("a view over a non-month range is allowed (exploration)", async () => {
    await expect(homeworkerService.getStatement(ADMIN, "hb1", "2026-03-10", "2026-03-20")).resolves.toBeDefined();
  });

  it("uses the current month when no period is given", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T00:00:00Z"));

    const result = await homeworkerService.getStatement(ADMIN, "hb1");

    expect(result.period).toEqual({ from: "2026-05-01", to: "2026-06-01", periodEndInclusive: "2026-05-31" });
  });

  it("returns booking lines then upsell lines, each tagged by type", async () => {
    vi.mocked(homeworkerRepository.getStatementLines).mockResolvedValue([{ bookingId: "bk1", net: "105.00" }] as never);
    vi.mocked(homeworkerRepository.getStatementUpsellLines).mockResolvedValue([{ bookingId: "bk0", amount: "30.00" }] as never);

    const result = await homeworkerService.getStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01");

    expect(result.lines).toEqual([
      { bookingId: "bk1", net: "105.00", type: "booking" },
      { bookingId: "bk0", amount: "30.00", type: "upsell" },
    ]);
    expect(homeworkerRepository.getStatementUpsellLines).toHaveBeenCalledWith("o1", "hb1", "2026-03-01", "2026-04-01");
  });

  it("403s a non-admin before any query", async () => {
    await expect(homeworkerService.getStatement(HW, "hb1")).rejects.toMatchObject({ statusCode: 403 });
    expect(homeworkerRepository.findHomeworkerBranch).not.toHaveBeenCalled();
  });

  it("404s when the branch is not a homeworker branch of the org", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue(null);

    await expect(homeworkerService.getStatement(ADMIN, "hb1")).rejects.toMatchObject({ statusCode: 404 });
    expect(homeworkerRepository.getStatementTotals).not.toHaveBeenCalled();
  });

  it("400s 'Profit share not set' when the branch has no share", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ ...BRANCH, profitSharePercent: null } as never);

    await expect(homeworkerService.getStatement(ADMIN, "hb1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Profit share not set",
    });
  });

  it("400s on an invalid period without querying", async () => {
    await expect(homeworkerService.getStatement(ADMIN, "hb1", "2026-04-01", "2026-03-01")).rejects.toMatchObject({ statusCode: 400 });
    expect(homeworkerRepository.findHomeworkerBranch).not.toHaveBeenCalled();
  });
});

describe("homeworkerService.getMyStatement", () => {
  it("resolves the caller's own branch (no admin needed)", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue({ id: "hb1" } as never);

    const result = await homeworkerService.getMyStatement(HW, "2026-03-01", "2026-04-01");

    expect(homeworkerRepository.findByOwner).toHaveBeenCalledWith("o1", "hw1");
    expect(homeworkerRepository.findHomeworkerBranch).toHaveBeenCalledWith("hb1", "o1");
    expect(result.homeworkerShare).toBe("70.00");
  });

  it("404s for a homeworker with no owned branch (legacy shared branch)", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue(null);

    await expect(homeworkerService.getMyStatement(HW)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s without a user id", async () => {
    await expect(homeworkerService.getMyStatement({ ...HW, userId: null })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("isCalendarMonth", () => {
  it("is true only for the 1st to the 1st of the next month", () => {
    expect(isCalendarMonth({ from: "2026-03-01", to: "2026-04-01" })).toBe(true);
    expect(isCalendarMonth({ from: "2026-12-01", to: "2027-01-01" })).toBe(true);
    expect(isCalendarMonth({ from: "2026-02-01", to: "2026-03-01" })).toBe(true);
  });

  it("is false for partial, multi-month or shifted ranges", () => {
    expect(isCalendarMonth({ from: "2026-03-02", to: "2026-04-01" })).toBe(false);
    expect(isCalendarMonth({ from: "2026-03-01", to: "2026-03-31" })).toBe(false);
    expect(isCalendarMonth({ from: "2026-03-01", to: "2026-05-01" })).toBe(false);
    expect(isCalendarMonth({ from: "2026-03-15", to: "2026-04-15" })).toBe(false);
  });
});

describe("homeworkerService.finaliseStatement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z"));
  });

  it("400s 'Period has not ended' while the period is still running", async () => {
    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-04-01", "2026-05-01")).rejects.toMatchObject({
      statusCode: 400,
      message: "Period has not ended",
    });
    expect(homeworkerRepository.insertStatement).not.toHaveBeenCalled();
  });

  it("allows finalising once to is today (exclusive end) or earlier", async () => {
    vi.setSystemTime(new Date("2026-05-01T00:00:00Z"));
    vi.mocked(homeworkerRepository.insertStatement).mockResolvedValue({ status: "created", row: { id: "st1" } } as never);

    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-04-01", "2026-05-01")).resolves.toEqual({ id: "st1" });
  });

  it("rejects non-calendar-month ranges with 400 before any lookup", async () => {
    for (const [from, to] of [["2026-03-02", "2026-04-01"], ["2026-03-01", "2026-03-31"], ["2026-01-01", "2026-03-01"], ["2026-03-15", "2026-04-15"]]) {
      await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", from, to)).rejects.toMatchObject({
        statusCode: 400,
        message: "Statements are finalised per calendar month",
      });
    }
    expect(homeworkerRepository.findHomeworkerBranch).not.toHaveBeenCalled();
    expect(homeworkerRepository.insertStatement).not.toHaveBeenCalled();
  });

  it("accepts a whole calendar month that has ended", async () => {
    vi.mocked(homeworkerRepository.insertStatement).mockResolvedValue({ status: "created", row: { id: "st1" } } as never);

    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01")).resolves.toEqual({ id: "st1" });
  });

  it("409s when any stored statement overlaps the period (even a different start)", async () => {
    vi.mocked(homeworkerRepository.findOverlappingStatement).mockResolvedValue({ id: "st0", periodStart: "2026-02-15", periodEnd: "2026-03-15" } as never);

    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01")).rejects.toMatchObject({ statusCode: 409 });
    expect(homeworkerRepository.findOverlappingStatement).toHaveBeenCalledWith("hb1", "2026-03-01", "2026-04-01");
    expect(homeworkerRepository.insertStatement).not.toHaveBeenCalled();
  });

  it("turns a duplicate result from the repository (concurrent finalise) into a 409", async () => {
    vi.mocked(homeworkerRepository.insertStatement).mockResolvedValue({ status: "duplicate" });

    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("computes the same totals and stores the final statement with the finaliser", async () => {
    vi.mocked(homeworkerRepository.insertStatement).mockResolvedValue({ status: "created", row: { id: "st1" } } as never);

    const row = await homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01");

    expect(homeworkerRepository.insertStatement).toHaveBeenCalledWith({
      orgId: "o1",
      branchId: "hb1",
      userId: "hw1",
      periodStart: "2026-03-01",
      periodEnd: "2026-04-01",
      periodEndInclusive: "2026-03-31",
      grossProfit: "100.00",
      sharePercent: "70.00",
      homeworkerShare: "70.00",
      orgShare: "30.00",
      finalisedBy: "admin1",
      auditName: null,
    });
    expect(row).toEqual({ id: "st1" });
  });

  it("403s a non-admin (a homeworker cannot finalise their own statement)", async () => {
    await expect(homeworkerService.finaliseStatement(HW, "hb1", "2026-03-01", "2026-04-01")).rejects.toMatchObject({ statusCode: 403 });
    expect(homeworkerRepository.insertStatement).not.toHaveBeenCalled();
  });

  it("404s for a non-homeworker branch and 400s without a share", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValueOnce(null);
    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01")).rejects.toMatchObject({ statusCode: 404 });

    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValueOnce({ ...BRANCH, profitSharePercent: null } as never);
    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-03-01", "2026-04-01")).rejects.toMatchObject({
      statusCode: 400,
      message: "Profit share not set",
    });
  });

  it("400s on an invalid period", async () => {
    await expect(homeworkerService.finaliseStatement(ADMIN, "hb1", "2026-04-01", "2026-03-01")).rejects.toMatchObject({ statusCode: 400 });
  });
});
