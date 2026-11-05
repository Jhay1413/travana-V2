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
vi.mock("../neon-client/neon-client.service", () => {
  // list() reads through viewNeonClientById; share one mock so both lookups behave the same here.
  const lookup = vi.fn();
  return { neonClientService: { getNeonClientById: lookup, viewNeonClientById: lookup } };
});

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
    dateOfBirth: null, passportNumber: null, passportExpiry: null, passportNonUk: false,
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
  it("is false without an expiry", () => {
    expect(computePassportWarning(null, "2026-11-01", "2026-10-31")).toBe(false);
    expect(computePassportWarning(null, null, "2026-10-31")).toBe(false);
  });
  it("is true when expiry is before departure + 6 months", () => {
    expect(computePassportWarning("2027-04-14", "2026-10-15", "2026-10-01")).toBe(true);
  });
  it("is true on exactly 6 months, false after", () => {
    expect(computePassportWarning("2027-04-15", "2026-10-15", "2026-10-01")).toBe(true);
    expect(computePassportWarning("2027-04-16", "2026-10-15", "2026-10-01")).toBe(false);
    expect(computePassportWarning("2030-01-01", "2026-10-15", "2026-10-01")).toBe(false);
  });
  it("handles month-end: 31 Aug departure flags up to and including 28 Feb", () => {
    expect(computePassportWarning("2027-02-28", "2026-08-31", "2026-08-01")).toBe(true);
    expect(computePassportWarning("2027-03-01", "2026-08-31", "2026-08-01")).toBe(false);
  });
  it("measures against today when there is no departure", () => {
    expect(computePassportWarning("2027-04-30", null, "2026-10-31")).toBe(true);
    expect(computePassportWarning("2027-05-01", null, "2026-10-31")).toBe(false);
  });
  it("already-expired passport warns", () => {
    expect(computePassportWarning("2020-01-01", "2026-08-31", "2026-08-01")).toBe(true);
    expect(computePassportWarning("2020-01-01", null, "2026-08-01")).toBe(true);
  });
});

describe("list", () => {
  it("synthesises the lead from the client when there is no lead row", async () => {
    vi.mocked(repo.findByClient).mockResolvedValue([row({ id: "p1" }), row({ id: "p2" })] as never);
    const res = await clientPassengerService.list("c1", SCOPE);
    expect(res.passengers[0]).toEqual({
      id: null, isLead: true, title: "Mr", firstName: "Jo", surname: "Bloggs",
      dateOfBirth: "1980-02-03", passportNumber: null, passportExpiry: null, passportNonUk: false, passportWarning: false,
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
  const FULL = { title: "Mr.", firstName: "Ann", surname: "Lee", dateOfBirth: "1990-01-01", passportNumber: "123456789", passportExpiry: "2040-01-01" };

  it("create trims and stores the six fields plus the Non-UK flag", async () => {
    vi.mocked(repo.create).mockResolvedValue(row() as never);
    await clientPassengerService.create("c1", { ...FULL, title: " Mr. ", firstName: " Ann ", surname: " Lee ", passportNumber: " 123456789 " }, SCOPE);
    expect(repo.create).toHaveBeenCalledWith("c1", { ...FULL, passportNonUk: false });
  });

  it("create upper-cases a Non-UK passport number", async () => {
    vi.mocked(repo.create).mockResolvedValue(row() as never);
    await clientPassengerService.create("c1", { ...FULL, passportNumber: " ab12345 ", passportNonUk: true }, SCOPE);
    expect(repo.create).toHaveBeenCalledWith("c1", { ...FULL, passportNumber: "AB12345", passportNonUk: true });
  });

  it.each([
    ["title", { title: " " }, "Title is required"],
    ["first name", { firstName: " " }, "First name is required"],
    ["surname", { surname: "" }, "Surname is required"],
    ["date of birth", { dateOfBirth: "" }, "Date of birth is required"],
    ["passport number", { passportNumber: "" }, "Passport number is required"],
    ["non-9-digit UK number", { passportNumber: "12345678" }, "Passport number must be exactly 9 digits (tick Non-UK passport for other formats)"],
    ["Non-UK number with a space", { passportNumber: "AB 1234", passportNonUk: true }, "Non-UK passport number must be 5 to 20 letters or digits, with no spaces"],
    ["passport expiry", { passportExpiry: "" }, "Passport expiry is required"],
  ])("create is refused (400) for a bad %s", async (_n, patch, message) => {
    await expect(clientPassengerService.create("c1", { ...FULL, ...patch }, SCOPE)).rejects.toMatchObject({ statusCode: 400, message });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("create blocks an expiry within 6 months of the next departure and allows the day after", async () => {
    vi.mocked(repo.findNextDepartureDate).mockResolvedValue("2026-10-15");
    vi.mocked(repo.create).mockResolvedValue(row() as never);
    await expect(clientPassengerService.create("c1", { ...FULL, passportExpiry: "2027-04-15" }, SCOPE)).rejects.toMatchObject({
      statusCode: 400,
      message: "Passport must be valid for more than 6 months after travel (until after 15/04/2027)",
    });
    expect(repo.create).not.toHaveBeenCalled();
    await clientPassengerService.create("c1", { ...FULL, passportExpiry: "2027-04-16" }, SCOPE);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("create is refused for an out-of-scope client", async () => {
    vi.mocked(neonClientService.getNeonClientById).mockRejectedValue(new AppError("Client not found", 404));
    await expect(clientPassengerService.create("c1", FULL, SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("setLeadPassport upserts and returns the synthesised lead", async () => {
    vi.mocked(repo.upsertLead).mockResolvedValue(row({ id: "L", isLead: true, passportNumber: "123456789", passportExpiry: "2040-01-01" }) as never);
    const lead = await clientPassengerService.setLeadPassport("c1", { passportNumber: " 123456789 ", passportExpiry: "2040-01-01" }, SCOPE);
    expect(repo.upsertLead).toHaveBeenCalledWith("c1", { passportNumber: "123456789", passportExpiry: "2040-01-01", passportNonUk: false });
    expect(lead).toMatchObject({ id: "L", isLead: true, firstName: "Jo", passportNumber: "123456789" });
  });

  it("setLeadPassport accepts a Non-UK number, upper-cased", async () => {
    vi.mocked(repo.upsertLead).mockResolvedValue(row({ id: "L", isLead: true }) as never);
    await clientPassengerService.setLeadPassport("c1", { passportNumber: "ab12345", passportExpiry: "2040-01-01", passportNonUk: true }, SCOPE);
    expect(repo.upsertLead).toHaveBeenCalledWith("c1", { passportNumber: "AB12345", passportExpiry: "2040-01-01", passportNonUk: true });
  });

  it.each([
    ["empty fields", { passportNumber: "", passportExpiry: "" }, "Passport number is required"],
    ["bad number", { passportNumber: "9", passportExpiry: "2040-01-01" }, "Passport number must be exactly 9 digits (tick Non-UK passport for other formats)"],
    ["missing expiry", { passportNumber: "123456789", passportExpiry: null }, "Passport expiry is required"],
  ])("setLeadPassport is refused (400) for %s", async (_n, input, message) => {
    await expect(clientPassengerService.setLeadPassport("c1", input, SCOPE)).rejects.toMatchObject({ statusCode: 400, message });
    expect(repo.upsertLead).not.toHaveBeenCalled();
  });

  it("setLeadPassport blocks an expiry within 6 months of the next departure", async () => {
    vi.mocked(repo.findNextDepartureDate).mockResolvedValue("2026-10-15");
    await expect(
      clientPassengerService.setLeadPassport("c1", { passportNumber: "123456789", passportExpiry: "2027-04-15" }, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: "Passport must be valid for more than 6 months after travel (until after 15/04/2027)" });
    expect(repo.upsertLead).not.toHaveBeenCalled();
  });

  it.each([{ title: null }, { DOB: null }, { title: "  " }])("setLeadPassport is blocked when the client record lacks title or date of birth (%o)", async (gap) => {
    vi.mocked(neonClientService.getNeonClientById).mockResolvedValue({ ...CLIENT, ...gap } as never);
    await expect(
      clientPassengerService.setLeadPassport("c1", { passportNumber: "123456789", passportExpiry: "2040-01-01" }, SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("title and date of birth") });
    expect(repo.upsertLead).not.toHaveBeenCalled();
  });

  it("update validates the MERGED passenger and stores the full normalised fields", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row({ ...FULL, passportNonUk: false }) as never);
    vi.mocked(repo.update).mockResolvedValue(row() as never);
    await clientPassengerService.update("c1", "p1", { firstName: " Bo " }, SCOPE);
    expect(repo.update).toHaveBeenCalledWith("c1", "p1", { ...FULL, firstName: "Bo", passportNonUk: false });
  });

  it("update uses the stored Non-UK flag when the patch only changes the number", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row({ ...FULL, passportNumber: "AB12345", passportNonUk: true }) as never);
    vi.mocked(repo.update).mockResolvedValue(row() as never);
    await clientPassengerService.update("c1", "p1", { passportNumber: "cd67890" }, SCOPE);
    expect(repo.update).toHaveBeenCalledWith("c1", "p1", expect.objectContaining({ passportNumber: "CD67890", passportNonUk: true }));
  });

  it("update blocks switching Non-UK off while the stored number is not 9 digits", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row({ ...FULL, passportNumber: "AB12345", passportNonUk: true }) as never);
    await expect(clientPassengerService.update("c1", "p1", { passportNonUk: false }, SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it("update of an old record with gaps is refused until completed, even for an unrelated patch", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row() as never); // names only
    await expect(clientPassengerService.update("c1", "p1", { firstName: "Z" }, SCOPE)).rejects.toMatchObject({ statusCode: 400, message: "Title is required" });
    expect(repo.update).not.toHaveBeenCalled();
    vi.mocked(repo.update).mockResolvedValue(row() as never);
    await clientPassengerService.update("c1", "p1", FULL, SCOPE);
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it("update blocks a patch that clears a mandatory field or breaks the expiry rule", async () => {
    vi.mocked(repo.findOne).mockResolvedValue(row({ ...FULL, passportNonUk: false }) as never);
    await expect(clientPassengerService.update("c1", "p1", { passportNumber: "" }, SCOPE)).rejects.toMatchObject({ message: "Passport number is required" });
    vi.mocked(repo.findNextDepartureDate).mockResolvedValue("2039-08-01");
    await expect(clientPassengerService.update("c1", "p1", {}, SCOPE)).rejects.toMatchObject({
      statusCode: 400,
      message: "Passport must be valid for more than 6 months after travel (until after 01/02/2040)",
    });
    expect(repo.update).not.toHaveBeenCalled();
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
