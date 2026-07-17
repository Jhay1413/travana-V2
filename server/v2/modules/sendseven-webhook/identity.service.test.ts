import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../contact-link/contact-link.repository", () => ({
  contactLinkRepository: {
    findByContact: vi.fn(),
    link: vi.fn(),
  },
}));
vi.mock("../neon-client/neon-client.service", () => ({
  neonClientService: {
    findMatches: vi.fn(),
    createNeonClient: vi.fn(),
  },
}));

import {
  extractPhoneNumber,
  resolveClientForOnboarding,
  resolveOrCreateByDetails,
  samePhoneNumber,
} from "./identity.service";
import { contactLinkRepository } from "../contact-link/contact-link.repository";
import { neonClientService } from "../neon-client/neon-client.service";

const ORG = "org-1";
const CONTACT = "contact-1";

function client(id: string, firstName: string, surename: string) {
  return { id, firstName, surename } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(neonClientService.createNeonClient).mockResolvedValue({ id: "new-client" } as never);
});

describe("resolveClientForOnboarding", () => {
  it("creates a new client when the phone matches nobody", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([] as never);

    const res = await resolveClientForOnboarding(ORG, CONTACT, { fullName: "John Smith", phone: "07123456789" });

    expect(res).toEqual({ status: "resolved", clientId: "new-client" });
    expect(neonClientService.createNeonClient).toHaveBeenCalledOnce();
    expect(contactLinkRepository.link).toHaveBeenCalledWith(ORG, CONTACT, "new-client", null);
  });

  it("flags a conflict when the number belongs to a differently-named client", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([client("c-james", "James", "Bouy")] as never);

    const res = await resolveClientForOnboarding(ORG, CONTACT, { fullName: "John", phone: "09356162084" });

    expect(res).toEqual({ status: "phone_conflict", existingNames: ["James Bouy"] });
    expect(contactLinkRepository.link).not.toHaveBeenCalled();
    expect(neonClientService.createNeonClient).not.toHaveBeenCalled();
  });

  it("allocates by name when one number is shared by several clients", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([
      client("c-jimmy", "Jimmy", "Kline"),
      client("c-myra", "Myra", "Cruz"),
      client("c-john", "John", "Reyes"),
    ] as never);

    const res = await resolveClientForOnboarding(ORG, CONTACT, { fullName: "John", phone: "09766273715" });

    expect(res).toEqual({ status: "resolved", clientId: "c-john" });
    expect(contactLinkRepository.link).toHaveBeenCalledWith(ORG, CONTACT, "c-john", null);
    expect(neonClientService.createNeonClient).not.toHaveBeenCalled();
  });

  it("links the existing record when the returning client's name matches", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([client("c-john", "John", "Smith")] as never);

    const res = await resolveClientForOnboarding(ORG, CONTACT, { fullName: "John Smith", phone: "07123456789" });

    expect(res).toEqual({ status: "resolved", clientId: "c-john" });
    expect(neonClientService.createNeonClient).not.toHaveBeenCalled();
  });

  it("does not match two different people who share a first name", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([client("c-jsmith", "John", "Smith")] as never);

    const res = await resolveClientForOnboarding(ORG, CONTACT, { fullName: "John Doe", phone: "07123456789" });

    expect(res).toEqual({ status: "phone_conflict", existingNames: ["John Smith"] });
  });

  it("lists every distinct name when several conflicting clients share the number", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([
      client("c-james", "James", "Bouy"),
      client("c-myra", "Myra", "Cruz"),
    ] as never);

    const res = await resolveClientForOnboarding(ORG, CONTACT, { fullName: "John", phone: "09356162084" });

    expect(res).toEqual({ status: "phone_conflict", existingNames: ["James Bouy", "Myra Cruz"] });
  });
});

describe("resolveOrCreateByDetails (no contact link)", () => {
  it("creates a client but never links a contact", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([] as never);

    const res = await resolveOrCreateByDetails(ORG, { fullName: "Friend", phone: "09355152084" });

    expect(res).toEqual({ status: "resolved", clientId: "new-client" });
    expect(neonClientService.createNeonClient).toHaveBeenCalledOnce();
    expect(contactLinkRepository.link).not.toHaveBeenCalled();
  });

  it("resolves an existing traveller by name without linking", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([client("c-james", "James", "Bond")] as never);

    const res = await resolveOrCreateByDetails(ORG, { fullName: "James", phone: "07123456789" });

    expect(res).toEqual({ status: "resolved", clientId: "c-james" });
    expect(contactLinkRepository.link).not.toHaveBeenCalled();
    expect(neonClientService.createNeonClient).not.toHaveBeenCalled();
  });

  it("reports a phone conflict for the traveller too", async () => {
    vi.mocked(neonClientService.findMatches).mockResolvedValue([client("c-x", "Someone", "Else")] as never);

    const res = await resolveOrCreateByDetails(ORG, { fullName: "James", phone: "09355152084" });

    expect(res).toEqual({ status: "phone_conflict", existingNames: ["Someone Else"] });
  });
});

describe("extractPhoneNumber", () => {
  it("pulls a phone number out of free text", () => {
    expect(extractPhoneNumber("09355152084")).toBe("09355152084");
    expect(extractPhoneNumber("his number is 09355152084 cheers")).toBe("09355152084");
    expect(extractPhoneNumber("+63 935 616 2084")).toBe("+63 935 616 2084");
  });

  it("ignores budgets, dates and short numbers", () => {
    expect(extractPhoneNumber("budget is 1000")).toBeNull();
    expect(extractPhoneNumber("4 nights from september 1")).toBeNull();
    expect(extractPhoneNumber("NCL airport")).toBeNull();
    expect(extractPhoneNumber("")).toBeNull();
  });
});

describe("samePhoneNumber", () => {
  it("matches on the last 8 digits ignoring formatting", () => {
    expect(samePhoneNumber("09356162084", "+63 935 616 2084")).toBe(true);
    expect(samePhoneNumber("09356162084", "09766273715")).toBe(false);
  });

  it("returns false for too-short or empty input", () => {
    expect(samePhoneNumber("", "09356162084")).toBe(false);
    expect(samePhoneNumber("123", "123")).toBe(false);
  });
});
