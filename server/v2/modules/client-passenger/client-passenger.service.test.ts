import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./client-passenger.repository", () => ({
  clientPassengerRepository: {
    findByClient: vi.fn(),
    findLead: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    upsertLead: vi.fn(),
    findNextDepartureDate: vi.fn(),
  },
}));
vi.mock("../neon-client/neon-client.service", () => ({
  neonClientService: { getNeonClientById: vi.fn() },
}));

import {
  clientPassengerService,
  addMonthsYmd,
  computePassportWarning,
  ukTodayYmd,
} from "./client-passenger.service";
import { clientPassengerRepository as repo } from "./client-passenger.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};
const CLIENT = { id: "c1", title: "Mr", firstName: "Jo", surename: "Bloggs", DOB: "1980-02-03" };

function row(over: Record<string, unknown> = {}) {
  return {
    id: "p1", clientId: "c1", isLead: false, title: null, firstName: "A", surname: "B",
    dateOfBirth: null, passportNumber: null, passportExpiry: null,
    createdAt: new Date(), updatedAt: new Date(), ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(neonClientService.getNeonClientById).mockResolvedValue(CLIENT as never);
  vi.mocked(repo.findNextDepartureDate).mockResolvedValue(null);
});

describe("date helpers", () => {
  it("addMonthsYmd clamps to month end", () => {
    expect(addMonthsYmd("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsYmd("2027-08-31", 6)).toBe("2028-02-29");
    expect(addMonthsYmd("2026-10-15", 6)).toBe("2027-04-15");
    expect(addMonthsYmd("2026-12-31", 6)).toBe("2027-06-30");
  });

  it("ukTodayYmd uses the London date, not UTC", () => {
    // 23:30 UTC on 30 Jun is already 1 Jul in London (BST).
    expect(ukTodayYmd(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01");
    expect(ukTodayYmd(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15");
  });
});

describe("computePassportWarning", () => {
  it("is false without expiry or without departure", () => {
    expect(computePassportWarning(null, "2026-11-01")).toBe(false);
    expect(computePassportWarning("2026-11-01", null)).toBe(false);
    expect(computePassportWarning(null, null)).toBe(false);
  });
  it("is true when expiry is before departure + 6 months", () => {
    expect(computePassportWarning("2027-04-14", "2026-10-15")).toBe(true);
  });
  it("is false on exactly 6 months and after", () => {
    expect(computePassportWarning("2027-04-15", "2026-10-15")).toBe(false);
    expect(computePassportWarning("2030-01-01", "2026-10-15")).toBe(false);
  });
  it("handles month-end: 31 Aug departure needs expiry on/after 28 Feb", () => {
    expect(computePassportWarning("2027-02-27", "2026-08-31")).toBe(true);
    expect(computePassportWarning("2027-02-28", "2026-08-31")).toBe(false);
  });
  it("already-expired passport warns", () => {
    expect(computePassportWarning("2020-01-01", "2026-08-31")).toBe(true);
  });
});

describe("list", () => {
  it("synthesises the lead from the client when there is no lead row", async () => {
    vi.mocked(repo.findByClient).mockResolvedValue([row({ id: "p1" }), row({ id: "p2" })] as never);
    const res = await clientPassengerService.list("c1", SCOPE);
    expect(res.passengers[0]).toEqual({
      id: null, isLead: true, title: "Mr", firstName: "Jo", surname: "Bloggs",
      dateOfBirth: "1980-02-03", passportNumber: null, passportExpiry: null, passportWarning: false,
    });
    expect(res.passengers.map((p) => p.id)).toEqual([null, "p1", "p2"]);
    expect(res.nextDeparture).toBeNull();
  });

  it("uses client identity plus the lead row's passport, and lead goes first", async () => {
    vi.mocked(repo.findNextDepartureDate).mockResolvedValue("2026-11-10");
    vi.mocked(repo.findByClient).mockResolvedValue([
      row({ id: "other", passportExpiry: "2027-01-01" }),
      row({ id: "lead1", isLead: true, firstName: "", surname: "", passportNumber: "123", passportExpiry: "2027-03-01" }),
    ] as never);
    const res = await clientPassengerService.list("c1", SCOPE);
    expect(res.nextDeparture).toBe("2026-11-10");
    expect(res.passengers[0]).toMatchObject({
      id: "lead1", isLead: true, firstName: "Jo", surname: "Bloggs", dateOfBirth: "1980-02-03",
      passportNumber: "123", passportExpiry: "2027-03-01", passportWarning: true,
    });
    expect(res.passengers[1]).toMatchObject({ id: "other", isLead: false, passportWarning: true });
    expect(res.passengers).toHaveLength(2);
  });

  it("404s (from the client lookup) before touching passengers", async () => {
    vi.mocked(neonClientService.getNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(clientPassengerService.list("c1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findByClient).not.toHaveBeenCalled();
  });
});

describe("writes", () => {
  it("create trims and turns empty strings into null", async () => {
    vi.mocked(repo.create).mockResolvedValue(row() as never);
    await clientPassengerService.create(
      "c1",
      { title: "", firstName: " Ann ", surname: " Lee ", dateOfBirth: "", passportNumber: "  ", passportExpiry: "" },
      SCOPE,
    );
    expect(repo.create).toHaveBeenCalledWith("c1", {
      title: null, firstName: "Ann", surname: "Lee", dateOfBirth: null, passportNumber: null, passportExpiry: null,
    });
  });

  it("create is refused for an out-of-scope client", async () => {
    vi.mocked(neonClientService.getNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(clientPassengerService.create("c1", { firstName: "A", surname: "B" }, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("setLeadPassport upserts and returns the synthesised lead", async () => {
    vi.mocked(repo.upsertLead).mockResolvedValue(row({ id: "L", isLead: true, passportNumber: "9", passportExpiry: "2030-01-01" }) as never);
    const lead = await clientPassengerService.setLeadPassport("c1", { passportNumber: " 9 ", passportExpiry: "2030-01-01" }, SCOPE);
    expect(repo.upsertLead).toHaveBeenCalledWith("c1", { passportNumber: "9", passportExpiry: "2030-01-01" });
    expect(lead).toMatchObject({ id: "L", isLead: true, firstName: "Jo", passportNumber: "9" });
  });

  it("setLeadPassport maps empty strings to null", async () => {
    vi.mocked(repo.upsertLead).mockResolvedValue(row({ id: "L", isLead: true }) as never);
    await clientPassengerService.setLeadPassport("c1", { passportNumber: "", passportExpiry: "" }, SCOPE);
    expect(repo.upsertLead).toHaveBeenCalledWith("c1", { passportNumber: null, passportExpiry: null });
  });

  it("update only sends provided fields, normalised", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row() as never);
    vi.mocked(repo.update).mockResolvedValue(row({ passportNumber: null }) as never);
    await clientPassengerService.update("c1", "p1", { passportNumber: "", firstName: " Bo " }, SCOPE);
    expect(repo.update).toHaveBeenCalledWith("c1", "p1", { passportNumber: null, firstName: "Bo" });
  });

  it("update of the lead row is 400", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row({ isLead: true }) as never);
    await expect(clientPassengerService.update("c1", "p1", { firstName: "X" }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("update of another client's passenger is 404", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(null);
    await expect(clientPassengerService.update("c1", "p9", { firstName: "X" }, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("delete of the lead row is 400", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row({ isLead: true }) as never);
    await expect(clientPassengerService.remove("c1", "p1", SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("delete of another client's passenger is 404", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(null);
    await expect(clientPassengerService.remove("c1", "p9", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("delete removes a normal passenger", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row() as never);
    vi.mocked(repo.remove).mockResolvedValue(true);
    await clientPassengerService.remove("c1", "p1", SCOPE);
    expect(repo.remove).toHaveBeenCalledWith("c1", "p1");
  });
});

describe("merged client", () => {
  beforeEach(() => {
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ ...CLIENT, status: "merged" } as never);
  });

  it.each([
    ["setLeadPassport", () => clientPassengerService.setLeadPassport("c1", { passportNumber: null, passportExpiry: null }, SCOPE)],
    ["create", () => clientPassengerService.create("c1", { firstName: "A", surname: "B" }, SCOPE)],
    ["update", () => clientPassengerService.update("c1", "p1", { firstName: "A" }, SCOPE)],
    ["remove", () => clientPassengerService.remove("c1", "p1", SCOPE)],
  ])("%s is refused with 400", async (_n, call) => {
    await expect(call()).rejects.toMatchObject({ statusCode: 400, message: "This client was merged into another client" });
    expect(repo.upsertLead).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("list still works", async () => {
    vi.mocked(repo.findByClient).mockResolvedValue([] as never);
    const res = await clientPassengerService.list("c1", SCOPE);
    expect(res.passengers).toHaveLength(1);
  });
});
