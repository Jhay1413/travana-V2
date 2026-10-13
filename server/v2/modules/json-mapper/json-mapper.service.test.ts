import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { jsonMapperRepository } from "./json-mapper.repository";
import { jsonMapperService } from "./json-mapper.service";
import { geoInferenceAiService } from "./geo-inference.ai.service";

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
// No live LLM: the inference service is mocked, default "no inference".
vi.mock("./geo-inference.ai.service", () => ({ geoInferenceAiService: { inferHierarchy: vi.fn() } }));

const repo = jsonMapperRepository as unknown as Record<string, Mock>;
const infer = geoInferenceAiService.inferHierarchy as unknown as Mock;

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
  infer.mockResolvedValue(null);
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

describe("mapJsonToIds — AI hierarchy inference", () => {
  const CHELSEA = { accommodation: "Chelsea Hotel, Toronto" };
  const TORONTO = { country: "Canada", destination: "Toronto", resort: "Toronto" };
  const NO_HIERARCHY = ["Cannot create accommodation without country", "Cannot create accommodation without resort"];

  beforeEach(() => {
    repo.findAccommodationByName.mockResolvedValue(null);
    repo.findCountryByName.mockResolvedValue(null);
    repo.findDestinationByName.mockResolvedValue(null);
    repo.findResortByName.mockResolvedValue(null);
    repo.createCountry.mockResolvedValue({ id: "c-new" });
    repo.createDestination.mockResolvedValue({ id: "d-new" });
    repo.createResort.mockResolvedValue({ id: "r-new" });
    repo.createAccommodation.mockResolvedValue({ id: "a-new" });
    repo.findAirportByCodeOrName.mockResolvedValue({ id: "airport-yyz" });
  });

  it("creates an inferred hierarchy for an accommodation-only deal and marks the warnings", async () => {
    infer.mockResolvedValue(TORONTO);

    const result = await jsonMapperService.mapJsonToIds(
      { ...CHELSEA, outboundArriveAirportName: "Toronto Pearson", quoteTitle: "Toronto city break" },
      "org-1",
    );

    expect(infer).toHaveBeenCalledTimes(1);
    expect(infer).toHaveBeenCalledWith(
      expect.objectContaining({ accommodation: "Chelsea Hotel, Toronto", arrivalAirportName: "Toronto Pearson", quoteTitle: "Toronto city break" }),
      "org-1",
    );
    expect(repo.createCountry).toHaveBeenCalledWith("Canada");
    expect(repo.createDestination).toHaveBeenCalledWith("Toronto", "c-new");
    expect(repo.createResort).toHaveBeenCalledWith("Toronto", "d-new");
    expect(repo.createAccommodation).toHaveBeenCalledWith("Chelsea Hotel, Toronto", "r-new");
    expect(result.accommodationId).toBe("a-new");
    expect(result.warnings).toContain('Created new country: "Canada" (inferred from accommodation)');
    expect(result.warnings).toContain('Created new destination: "Toronto" (inferred from accommodation)');
    expect(result.warnings).toContain('Created new resort: "Toronto" (inferred from accommodation)');
  });

  it("falls back to today's warnings and creates nothing when the AI returns null", async () => {
    infer.mockResolvedValue(null);

    const result = await jsonMapperService.mapJsonToIds(CHELSEA);

    expect(repo.createCountry).not.toHaveBeenCalled();
    expect(repo.createAccommodation).not.toHaveBeenCalled();
    expect(result.accommodationId).toBe("");
    expect(result.warnings).toEqual(NO_HIERARCHY);
  });

  it("still succeeds with today's warnings when the AI call throws", async () => {
    infer.mockRejectedValue(new Error("timeout"));

    const result = await jsonMapperService.mapJsonToIds(CHELSEA);

    expect(result.accommodationId).toBe("");
    expect(result.warnings).toEqual(NO_HIERARCHY);
  });

  it("does not override a scraped country and passes it to the model as fixed context", async () => {
    infer.mockResolvedValue(TORONTO);
    repo.findCountryByName.mockResolvedValue({ id: "c-us" });

    const result = await jsonMapperService.mapJsonToIds({ ...CHELSEA, country: "United States" });

    expect(infer).toHaveBeenCalledWith(expect.objectContaining({ country: "United States" }), undefined);
    expect(repo.findCountryByName).toHaveBeenCalledWith("United States");
    expect(repo.findCountryByName).not.toHaveBeenCalledWith("Canada");
    expect(repo.createCountry).not.toHaveBeenCalled();
    expect(repo.createDestination).toHaveBeenCalledWith("Toronto", "c-us");
    expect(result.countryId).toBe("c-us");
    expect(result.warnings.some((w) => w.includes("country"))).toBe(false);
  });

  it("does not call the AI when the scrape already has the full chain", async () => {
    await jsonMapperService.mapJsonToIds({ ...CHELSEA, country: "Canada", destination: "Toronto", resort: "Toronto" });
    expect(infer).not.toHaveBeenCalled();
  });

  it("infers the country for a destination-only scrape and keeps the scraped destination", async () => {
    infer.mockResolvedValue({ country: "Canada", destination: "Greater Toronto", resort: "Downtown" });

    const result = await jsonMapperService.mapJsonToIds({ ...CHELSEA, destination: "Toronto", resort: "Toronto" });

    expect(infer).toHaveBeenCalledTimes(1);
    expect(repo.createCountry).toHaveBeenCalledWith("Canada");
    expect(repo.createDestination).toHaveBeenCalledWith("Toronto", "c-new");
    expect(repo.createResort).toHaveBeenCalledWith("Toronto", "d-new");
    expect(result.warnings).toContain('Created new country: "Canada" (inferred from accommodation)');
    expect(result.warnings).toContain('Created new destination: "Toronto"');
  });

  it("matches an AI-named country that already exists instead of duplicating it", async () => {
    infer.mockResolvedValue(TORONTO);
    repo.findCountryByName.mockResolvedValue({ id: "c-ca" });
    repo.findDestinationByName.mockResolvedValue({ id: "d-to" });
    repo.findResortByName.mockResolvedValue({ id: "r-to" });

    const result = await jsonMapperService.mapJsonToIds(CHELSEA);

    expect(repo.createCountry).not.toHaveBeenCalled();
    expect(repo.createDestination).not.toHaveBeenCalled();
    expect(repo.createResort).not.toHaveBeenCalled();
    expect(repo.createAccommodation).toHaveBeenCalledWith("Chelsea Hotel, Toronto", "r-to");
    expect(result.countryId).toBe("c-ca");
    expect(result.warnings).toContain('Matched existing country: "Canada" (inferred from accommodation)');
  });

  it("asks the AI once when the same accommodation appears on several line items", async () => {
    infer.mockResolvedValue(TORONTO);

    await jsonMapperService.mapJsonToIds({
      ...CHELSEA,
      extraAccommodations: [{ accommodation: "Chelsea Hotel, Toronto" }, { accommodation: "chelsea hotel, toronto" }],
    });

    expect(infer).toHaveBeenCalledTimes(1);
    expect(repo.createCountry).toHaveBeenCalledTimes(1);
  });
});
