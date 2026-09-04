import { beforeEach, describe, expect, it, vi } from "vitest";

// The cruise import path resolved every catalog value EXCEPT the quote's tour
// operator, so an imported cruise landed with an empty operator dropdown. It
// went unnoticed while most cruise pages failed cruise detection and fell
// through to the scraper path, which does set it.
const mapToIds = vi.fn();
vi.mock("@/features/json-mapper/api/json-mapper.api", () => ({
  jsonMapperApi: { mapToIds: (...args: unknown[]) => mapToIds(...args) },
}));
vi.mock("@/lib/scraper-json-parser", () => ({
  mapScraperJsonToFormFields: () => ({ fields: {} }),
}));

const { handleJsonData } = await import("./json-import-handler");

function makeDeps() {
  const values: Record<string, unknown> = {};
  return {
    values,
    deps: {
      form: { setValue: (k: string, v: unknown) => { values[k] = v; } },
      packageTypesData: [{ id: "pkg-cruise", name: "Cruise Package" }],
      queryClient: { invalidateQueries: vi.fn(), setQueryData: vi.fn(), getQueryData: vi.fn() },
      toast: vi.fn(),
      lookupKeys: {},
      airportsData: [],
    } as never,
  };
}

describe("cruise import: tour operator", () => {
  beforeEach(() => {
    mapToIds.mockReset();
    mapToIds.mockResolvedValue({ tourOperatorId: "op-1", cruiseLineId: "cl-1", shipId: "sh-1", warnings: [] });
  });

  const cruise = {
    cruise_line: "Cunard",
    ship_name: "Queen Elizabeth",
    cruise_date: "2027-10-29",
    tour_operator: "Cunard",
    quote_title: "Spain and Eastern Caribbean",
  };

  it("sends the operator to the mapper and sets the resolved id", async () => {
    const { values, deps } = makeDeps();
    await handleJsonData(cruise, deps);
    expect(mapToIds).toHaveBeenCalledWith(expect.objectContaining({ tourOperator: "Cunard" }));
    expect(values.tourOperatorId).toBe("op-1");
  });

  it("falls back to the cruise line when the scrape named no operator", async () => {
    const { values, deps } = makeDeps();
    const { tour_operator, ...noOperator } = cruise;
    await handleJsonData(noOperator, deps);
    // On a cruise line's own site the operator IS the line.
    expect(mapToIds).toHaveBeenCalledWith(expect.objectContaining({ tourOperator: "Cunard" }));
    expect(values.tourOperatorId).toBe("op-1");
  });

  it("leaves the operator alone when the mapper resolved none", async () => {
    const { values, deps } = makeDeps();
    mapToIds.mockResolvedValue({ tourOperatorId: "", warnings: [] });
    await handleJsonData(cruise, deps);
    expect(values.tourOperatorId).toBeUndefined();
  });
});

// The package type decides whether the cruise section renders at all. Resolving
// it used to fail silently whenever the lookup snapshot was empty, and the
// form's "default to Package Holiday" effect then stamped a cruise as a package
// holiday with nothing said.
describe("cruise import: package type", () => {
  beforeEach(() => {
    mapToIds.mockReset();
    mapToIds.mockResolvedValue({ tourOperatorId: "op-1", warnings: [] });
  });

  const cruise = { cruise_line: "Cunard", ship_name: "Queen Elizabeth", cruise_date: "2027-10-29" };

  it("sets Cruise Package from the lookup snapshot", async () => {
    const { values, deps } = makeDeps();
    await handleJsonData(cruise, deps);
    expect(values.packageType).toBe("pkg-cruise");
  });

  it("falls back to the live query cache when the snapshot is empty", async () => {
    const { values, deps } = makeDeps();
    (deps as any).packageTypesData = undefined;
    (deps as any).queryClient.getQueryData = (key: readonly unknown[]) =>
      JSON.stringify(key) === JSON.stringify(["lookup", "package-types"])
        ? [{ id: "pkg-cruise", name: "Cruise Package" }]
        : undefined;
    await handleJsonData(cruise, deps);
    expect(values.packageType).toBe("pkg-cruise");
  });

  it("says so instead of silently leaving a cruise as a package holiday", async () => {
    const { values, deps } = makeDeps();
    (deps as any).packageTypesData = undefined;
    (deps as any).queryClient.getQueryData = () => undefined;
    await handleJsonData(cruise, deps);
    expect(values.packageType).toBeUndefined();
    expect((deps as any).toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Package type not set", variant: "destructive" }),
    );
  });
});
