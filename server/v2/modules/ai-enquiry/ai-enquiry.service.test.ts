import { describe, it, expect } from "vitest";
import { intentSchema, buildExtractionSystemPrompt } from "./ai-enquiry.service";

describe("intentSchema", () => {
  it("applies defaults when every field is null (the common gpt-4o response shape)", () => {
    const result = intentSchema.safeParse({
      enquiryTitle: null,
      holidayType: null,
      countries: null,
      destinations: null,
      resorts: null,
      departureAirports: null,
      boardBasis: null,
      starRating: null,
      travelDate: null,
      flexibility: null,
      nights: null,
      adults: null,
      children: null,
      infants: null,
      childAges: null,
      budget: null,
      budgetType: null,
      notes: null,
      confidence: null,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      enquiryTitle: "",
      holidayType: "",
      countries: [],
      destinations: [],
      resorts: [],
      departureAirports: [],
      boardBasis: [],
      starRating: "",
      travelDate: "",
      flexibility: "",
      nights: null,
      adults: 2,
      children: 0,
      infants: 0,
      childAges: [],
      budget: "",
      budgetType: "Per Person",
      notes: "",
      confidence: "low",
    });
  });

  it("applies defaults when every field is undefined (omitted keys)", () => {
    const result = intentSchema.safeParse({});

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.budget).toBe("");
    expect(result.data.adults).toBe(2);
    expect(result.data.confidence).toBe("low");
  });

  it("filters null entries out of array fields instead of failing", () => {
    const result = intentSchema.safeParse({
      countries: ["Greece", null, "Spain"],
      childAges: [4, null, 8],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.countries).toEqual(["Greece", "Spain"]);
    expect(result.data.childAges).toEqual([4, 8]);
  });

  it("accepts a numeric budget and stringifies it", () => {
    const result = intentSchema.safeParse({ budget: 1500 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.budget).toBe("1500");
  });

  it("accepts a string budget as-is", () => {
    const result = intentSchema.safeParse({ budget: "2000" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.budget).toBe("2000");
  });

  it("still rejects a null top-level payload (existing 502 behavior)", () => {
    const result = intentSchema.safeParse(null);
    expect(result.success).toBe(false);
  });
});

describe("buildExtractionSystemPrompt", () => {
  it("anchors the prompt to the given date so relative dates can be grounded", () => {
    const now = new Date("2026-07-20T12:34:56.000Z");
    const prompt = buildExtractionSystemPrompt(now);
    expect(prompt).toContain("Today's date is 2026-07-20.");
    expect(prompt).toContain("All travel dates must be in the future.");
  });

  it("uses a different date when a different `now` is passed", () => {
    const prompt = buildExtractionSystemPrompt(new Date("2027-01-05T00:00:00.000Z"));
    expect(prompt).toContain("Today's date is 2027-01-05.");
  });
});
