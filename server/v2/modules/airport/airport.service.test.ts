import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./airport.repository", () => ({
  airportRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    countEnquiryDepartures: vi.fn(),
    countQuoteDepartures: vi.fn(),
  },
}));

import { airportService } from "./airport.service";
import { airportRepository } from "./airport.repository";

const repo = vi.mocked(airportRepository);
beforeEach(() => vi.resetAllMocks());

describe("airportService.mostUsedDepartureAirportIds", () => {
  it("scopes both counts to the caller org", async () => {
    repo.countEnquiryDepartures.mockResolvedValue([]);
    repo.countQuoteDepartures.mockResolvedValue([]);
    await airportService.mostUsedDepartureAirportIds("org-1");
    expect(repo.countEnquiryDepartures).toHaveBeenCalledWith("org-1");
    expect(repo.countQuoteDepartures).toHaveBeenCalledWith("org-1");
  });

  it("fails closed with no org", async () => {
    await expect(airportService.mostUsedDepartureAirportIds("")).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.countEnquiryDepartures).not.toHaveBeenCalled();
  });

  it("merges enquiry and quote counts, most used first, pinned excluded, capped at 5", async () => {
    repo.countEnquiryDepartures.mockResolvedValue([
      { airportId: "bhx", code: "BHX", uses: 3 },
      { airportId: "man", code: "MAN", uses: 99 },
      { airportId: "brs", code: "brs", uses: 1 },
      { airportId: "a1", code: "A1", uses: 1 },
      { airportId: "a2", code: "A2", uses: 1 },
      { airportId: "a3", code: "A3", uses: 1 },
    ]);
    repo.countQuoteDepartures.mockResolvedValue([
      { airportId: "brs", code: "BRS", uses: 4 },
      { airportId: "ncl", code: "ncl", uses: 50 },
    ]);
    const ids = await airportService.mostUsedDepartureAirportIds("org-1");
    expect(ids).toEqual(["brs", "bhx", "a1", "a2", "a3"]);
    expect(ids).not.toContain("man");
    expect(ids).not.toContain("ncl");
  });
});
