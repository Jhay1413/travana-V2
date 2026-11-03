import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./departures.repository", () => ({
  departuresRepository: {
    listRows: vi.fn(),
    findRow: vi.fn(),
    findUserName: vi.fn(),
    upsertCheck: vi.fn(),
  },
}));

import { departuresService, resolveAccess } from "./departures.service";
import { departuresRepository as repo } from "./departures.repository";
import type { DepartureRawRow, StoredChecks } from "./departures.types";

const NOW = new Date("2026-10-20T10:00:00Z");

const admin = { orgId: "o1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "u1" } as never;
const manager = { orgId: "o1", branchId: "b1", orgRole: "branch_manager", orgRoles: ["branch_manager"], userId: "u1" } as never;

function raw(over: Partial<DepartureRawRow> = {}): DepartureRawRow {
  return {
    bookingId: "bk1", transactionId: "t1", clientId: "c1", firstName: "Ann", surename: "Lee",
    travelDate: "2026-10-22", nights: 7, title: "Crete", destination: "Crete",
    operatorName: "Jet2", operatorLogoUrl: null, haysRef: "H1", supplierRef: "S1",
    checkIn: null, ticketsInHouse: null, passportInfo: null, ticketsPickUp: null, completed: null, fullyPaid: null,
    lastChangeBy: null, lastChangeByName: null, lastChangeAt: null, lastChangeWhat: null,
    ...over,
  };
}

function stored(over: Partial<StoredChecks> = {}): StoredChecks {
  return {
    checkIn: false, ticketsInHouse: false, passportInfo: false, ticketsPickUp: false, completed: false, fullyPaid: false,
    lastChangeBy: "u1", lastChangeByName: "Viewer Name", lastChangeAt: NOW, lastChangeWhat: "x",
    ...over,
  };
}

const allFour = { checkIn: true, ticketsInHouse: true, passportInfo: true, ticketsPickUp: true };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.findUserName).mockResolvedValue("Viewer Name");
});

describe("resolveAccess", () => {
  it("fails closed without an organisation", () => {
    expect(() => resolveAccess({ ...(admin as object), orgId: "" } as never)).toThrowError(
      expect.objectContaining({ statusCode: 403, message: "Select an organisation first" }),
    );
  });

  it("org and platform admins see the organisation", () => {
    expect(resolveAccess(admin)).toEqual({ orgId: "o1", branchId: null });
    expect(resolveAccess({ ...(admin as object), orgRole: "platform_admin" } as never)).toEqual({ orgId: "o1", branchId: null });
  });

  it("a branch manager is held to their branch, and needs one", () => {
    expect(resolveAccess(manager)).toEqual({ orgId: "o1", branchId: "b1" });
    expect(() => resolveAccess({ ...(manager as object), branchId: null } as never)).toThrowError(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});

describe("list", () => {
  it("defaults from to today in London and maps rows with all-false checks when no row exists", async () => {
    vi.mocked(repo.listRows).mockResolvedValue([raw()]);
    const { rows } = await departuresService.list(admin, undefined, undefined, NOW);
    expect(repo.listRows).toHaveBeenCalledWith({ orgId: "o1", branchId: null, fromYmd: "2026-10-20", toExclYmd: null });
    expect(rows[0]).toMatchObject({
      bookingId: "bk1", clientName: "Ann Lee", leadPassenger: "Ann Lee", lastChange: null,
      checks: { checkIn: false, ticketsInHouse: false, passportInfo: false, ticketsPickUp: false, completed: false, fullyPaid: false },
    });
  });

  it("London today follows BST (23:30 UTC on 20 Oct is already 21 Oct in London)", async () => {
    vi.mocked(repo.listRows).mockResolvedValue([]);
    await departuresService.list(admin, undefined, undefined, new Date("2026-10-20T23:30:00Z"));
    expect(vi.mocked(repo.listRows).mock.calls[0][0].fromYmd).toBe("2026-10-21");
  });

  it("passes explicit from and to, and the branch for a manager", async () => {
    vi.mocked(repo.listRows).mockResolvedValue([]);
    await departuresService.list(manager, "2026-11-01", "2026-11-08", NOW);
    expect(repo.listRows).toHaveBeenCalledWith({ orgId: "o1", branchId: "b1", fromYmd: "2026-11-01", toExclYmd: "2026-11-08" });
  });

  it("serialises the last change", async () => {
    vi.mocked(repo.listRows).mockResolvedValue([
      raw({ lastChangeBy: "u2", lastChangeByName: "Bob", lastChangeAt: NOW, lastChangeWhat: "Check in", checkIn: true }),
    ]);
    const { rows } = await departuresService.list(admin, undefined, undefined, NOW);
    expect(rows[0].lastChange).toEqual({ by: "u2", byName: "Bob", at: NOW.toISOString(), what: "Check in" });
    expect(rows[0].checks.checkIn).toBe(true);
  });

  it("refuses without an organisation before touching the repository", async () => {
    await expect(departuresService.list({ ...(admin as object), orgId: "" } as never)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.listRows).not.toHaveBeenCalled();
  });
});

describe("summary", () => {
  it("counts over one list query from today to today + days", async () => {
    vi.mocked(repo.listRows).mockResolvedValue([
      raw({ bookingId: "a", travelDate: "2026-10-21" }),
      raw({ bookingId: "b", travelDate: "2026-10-26", passportInfo: true, fullyPaid: true, completed: true }),
    ]);
    const s = await departuresService.summary(admin, 7, NOW);
    expect(repo.listRows).toHaveBeenCalledTimes(1);
    expect(repo.listRows).toHaveBeenCalledWith({ orgId: "o1", branchId: null, fromYmd: "2026-10-20", toExclYmd: "2026-10-28" });
    expect(s).toEqual({ days: 7, upcoming: 2, notCompleted: 1, passportMissing: 1, leavingSoonNotCompleted: 1, notPaid: 1, notPaidSoon: 1 });
  });

  it("defaults to 7 days", async () => {
    vi.mocked(repo.listRows).mockResolvedValue([]);
    const s = await departuresService.summary(manager, undefined, NOW);
    expect(s.days).toBe(7);
    expect(repo.listRows).toHaveBeenCalledWith(expect.objectContaining({ branchId: "b1", toExclYmd: "2026-10-28" }));
  });
});

describe("setCheck", () => {
  it("404s a booking outside the scope and writes nothing", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(null);
    await expect(departuresService.setCheck(manager, "bk9", "checkIn", true, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findRow).toHaveBeenCalledWith({ orgId: "o1", branchId: "b1", fromYmd: null, toExclYmd: null, bookingId: "bk9" });
    expect(repo.upsertCheck).not.toHaveBeenCalled();
  });

  it("ticks a check, stamps who and when, and returns the stored row", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(raw());
    vi.mocked(repo.upsertCheck).mockResolvedValue(stored({ checkIn: true, lastChangeWhat: "Check in" }));
    const row = await departuresService.setCheck(admin, "bk1", "checkIn", true, NOW);
    expect(repo.upsertCheck).toHaveBeenCalledWith("o1", "bk1", { checkIn: true }, { by: "u1", byName: "Viewer Name", at: NOW, what: "Check in" });
    expect(row.checks.checkIn).toBe(true);
    expect(row.lastChange).toEqual({ by: "u1", byName: "Viewer Name", at: NOW.toISOString(), what: "Check in" });
  });

  it("stamps the unticked, completed, reopened and paid texts", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(raw({ ...allFour, completed: true }));
    vi.mocked(repo.upsertCheck).mockResolvedValue(stored());
    const whatFor = async (key: Parameters<typeof departuresService.setCheck>[2], value: boolean) => {
      await departuresService.setCheck(admin, "bk1", key, value, NOW);
      return vi.mocked(repo.upsertCheck).mock.lastCall?.[3].what;
    };
    expect(await whatFor("passportInfo", false)).toBe("Passport info unticked");
    expect(await whatFor("ticketsInHouse", false)).toBe("Tickets in house unticked");
    expect(await whatFor("ticketsPickUp", false)).toBe("Tickets pick up unticked");
    expect(await whatFor("checkIn", false)).toBe("Check in unticked");
    expect(await whatFor("completed", false)).toBe("Reopened");
    expect(await whatFor("completed", true)).toBe("Completed");
    expect(await whatFor("fullyPaid", true)).toBe("Fully paid");
    expect(await whatFor("fullyPaid", false)).toBe("Marked not paid");
  });

  it("refuses completed=true until the four checks are ticked (400)", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(raw({ checkIn: true, ticketsInHouse: true, passportInfo: true, ticketsPickUp: false }));
    await expect(departuresService.setCheck(admin, "bk1", "completed", true, NOW)).rejects.toMatchObject({
      statusCode: 400,
      message: "Tick the four checks first",
    });
    expect(repo.upsertCheck).not.toHaveBeenCalled();
  });

  it("allows completed=true once the four are ticked", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(raw(allFour));
    vi.mocked(repo.upsertCheck).mockResolvedValue(stored({ ...allFour, completed: true }));
    const row = await departuresService.setCheck(admin, "bk1", "completed", true, NOW);
    expect(repo.upsertCheck).toHaveBeenCalledWith("o1", "bk1", { completed: true }, expect.objectContaining({ what: "Completed" }));
    expect(row.checks.completed).toBe(true);
  });

  it("unticking any of the four also resets completed", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(raw({ ...allFour, completed: true }));
    vi.mocked(repo.upsertCheck).mockResolvedValue(stored({ ...allFour, passportInfo: false }));
    await departuresService.setCheck(admin, "bk1", "passportInfo", false, NOW);
    expect(repo.upsertCheck).toHaveBeenCalledWith("o1", "bk1", { passportInfo: false, completed: false }, expect.anything());
  });

  it("unticking completed or fullyPaid touches only that column; ticking a check does not set completed", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(raw(allFour));
    vi.mocked(repo.upsertCheck).mockResolvedValue(stored());
    await departuresService.setCheck(admin, "bk1", "fullyPaid", false, NOW);
    expect(vi.mocked(repo.upsertCheck).mock.lastCall?.[2]).toEqual({ fullyPaid: false });
    await departuresService.setCheck(admin, "bk1", "checkIn", true, NOW);
    expect(vi.mocked(repo.upsertCheck).mock.lastCall?.[2]).toEqual({ checkIn: true });
  });

  it("records no user when the scope has none", async () => {
    vi.mocked(repo.findRow).mockResolvedValue(raw());
    vi.mocked(repo.upsertCheck).mockResolvedValue(stored());
    await departuresService.setCheck({ ...(admin as object), userId: null } as never, "bk1", "checkIn", true, NOW);
    expect(repo.findUserName).not.toHaveBeenCalled();
    expect(vi.mocked(repo.upsertCheck).mock.lastCall?.[3]).toMatchObject({ by: null, byName: null });
  });
});
