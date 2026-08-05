import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { jsonMapperRepository } from "./json-mapper.repository";
import { jsonMapperService } from "./json-mapper.service";

// End-to-end resolution order for the primary accommodation (the Jet2holidays
// "Cala Nova" import): global exact lookup → resolve the JSON's own
// country/destination/resort chain → retry within that resort → create there.

vi.mock("./json-mapper.repository", () => ({
  jsonMapperRepository: {
    findCountryByName: vi.fn(),
    findDestinationByName: vi.fn(),
    findResortByName: vi.fn(),
    findAccommodationByName: vi.fn(),
    getHierarchyFromAccommodation: vi.fn(),
    findBoardBasisByType: vi.fn(),
    findTourOperatorByName: vi.fn(),
    findAirportByCodeOrName: vi.fn(),
    findRoomTypeByName: vi.fn(),
    findLodgeByCode: vi.fn(),
    findLodgeByName: vi.fn(),
    findParkByName: vi.fn(),
    findParkByCode: vi.fn(),
    createCountry: vi.fn(),
    createDestination: vi.fn(),
    createResort: vi.fn(),
    createAccommodation: vi.fn(),
    createBoardBasis: vi.fn(),
    createTourOperator: vi.fn(),
    createRoomType: vi.fn(),
    createAirport: vi.fn(),
    createPark: vi.fn(),
    createLodge: vi.fn(),
  },
}));
vi.mock("../../settings/cruise/cruise.repository", () => ({ cruiseSettingsRepository: {} }));

const repo = jsonMapperRepository as unknown as Record<string, Mock>;

const CALA_NOVA_INPUT = {
  country: "Spain",
  destination: "Gran Canaria",
  resort: "Puerto Rico",
  accommodation: "Cala Nova",
};

beforeEach(() => {
  vi.clearAllMocks();
  repo.findCountryByName.mockResolvedValue({ id: "country-es" });
  repo.findDestinationByName.mockResolvedValue({ id: "dest-gc" });
  repo.findResortByName.mockResolvedValue({ id: "resort-pr" });
});

describe("mapJsonToIds — primary accommodation resolution", () => {
  it("creates the accommodation under the JSON's own resort when nothing matches exactly", async () => {
    // Catalog has no exact "Cala Nova" anywhere (only look-alikes elsewhere),
    // and nothing similar inside Puerto Rico either.
    repo.findAccommodationByName.mockResolvedValue(null);
    repo.createAccommodation.mockResolvedValue({ id: "acc-new" });

    const result = await jsonMapperService.mapJsonToIds(CALA_NOVA_INPUT);

    expect(repo.findAccommodationByName).toHaveBeenNthCalledWith(1, "Cala Nova");
    expect(repo.findAccommodationByName).toHaveBeenNthCalledWith(2, "Cala Nova", "resort-pr");
    expect(repo.createAccommodation).toHaveBeenCalledWith("Cala Nova", "resort-pr");
    expect(result.accommodationId).toBe("acc-new");
    expect(result.countryId).toBe("country-es");
    expect(result.destinationId).toBe("dest-gc");
    expect(result.resortId).toBe("resort-pr");
    expect(result.warnings).toContain('Created new accommodation: "Cala Nova"');
  });

  it("reuses a near-name row inside the same resort instead of creating a duplicate", async () => {
    repo.findAccommodationByName.mockImplementation(async (_name: string, resortId?: string) =>
      resortId === "resort-pr" ? { id: "acc-apartments" } : null,
    );

    const result = await jsonMapperService.mapJsonToIds(CALA_NOVA_INPUT);

    expect(result.accommodationId).toBe("acc-apartments");
    expect(repo.createAccommodation).not.toHaveBeenCalled();
  });

  it("uses a global exact match (and its hierarchy) when one exists", async () => {
    repo.findAccommodationByName.mockResolvedValue({ id: "acc-exact" });
    repo.getHierarchyFromAccommodation.mockResolvedValue({
      resort: { id: "resort-x" },
      destination: { id: "dest-x" },
      country: { id: "country-x" },
    });

    const result = await jsonMapperService.mapJsonToIds(CALA_NOVA_INPUT);

    expect(repo.findAccommodationByName).toHaveBeenCalledTimes(1);
    expect(repo.findAccommodationByName).toHaveBeenCalledWith("Cala Nova");
    expect(result.accommodationId).toBe("acc-exact");
    expect(result.resortId).toBe("resort-x");
    expect(repo.createAccommodation).not.toHaveBeenCalled();
  });
});
