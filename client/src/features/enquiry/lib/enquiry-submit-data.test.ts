import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, type EnquiryForm } from "./enquiry-form";
import { buildEnquirySubmitData } from "./enquiry-submit-data";

const base: EnquiryForm = {
  ...DEFAULT_FORM,
  title: " Maldives family ",
  holidayType: "pt1",
  holidayTypeName: "Package Holiday",
  flexibleNights: ["10", "7"],
  notes: "Sea view",
};

// JSON drops undefined, which is what actually goes over the wire.
const keysOf = (o: object) => Object.keys(JSON.parse(JSON.stringify(o)) as object).sort();

describe("buildEnquirySubmitData: package holiday", () => {
  const form: EnquiryForm = {
    ...base,
    destinations: ["d1"],
    resorts: ["r1"],
    accommodations: ["a1"],
    boardBasis: ["b1"],
    airports: ["ap1"],
    travelDate: "2026-07-01",
    flexibility: "+/- 3 Days",
    adults: 2,
    children: 2,
    infants: 1,
    childAges: [4, 9],
    starRating: "4 Star",
    budget: "3000",
    budgetType: "Package",
    isTest: true,
  };

  it("sends the wizard's package keys, nights as numbers with the first as primary", () => {
    const d = buildEnquirySubmitData(form);
    expect(keysOf(d)).toEqual(
      [
        "title", "holiday_type_id", "notes", "is_test", "travel_date", "adults", "children", "infants", "no_of_nights",
        "flexible_nights", "budget", "budget_type", "accom_min_star_rating", "flexibility_date", "destinations",
        "resorts", "accommodations", "boardBases", "departureAirports", "passengers",
      ].sort(),
    );
    expect(d).toMatchObject({
      title: "Maldives family",
      holiday_type_id: "pt1",
      is_test: true,
      no_of_nights: 10,
      flexible_nights: [10, 7],
      boardBases: ["b1"],
      departureAirports: ["ap1"],
      passengers: [
        { type: "child", age: 4 },
        { type: "child", age: 9 },
      ],
    });
  });

  it("omits empty lists and blanks", () => {
    const d = buildEnquirySubmitData({ ...base, flexibleNights: [] });
    expect(keysOf(d)).toEqual(["title", "holiday_type_id", "notes", "is_test", "adults", "children", "infants", "budget_type"].sort());
  });
});

describe("buildEnquirySubmitData: hot tub break", () => {
  const form: EnquiryForm = {
    ...base,
    holidayTypeName: "Hot Tub Break",
    destinations: ["d1", "d2"],
    accommodationType: "at1",
    guests: 4,
    pets: 2,
    budget: "500",
    maxBudget: "900",
    weekendLodge: true,
    flexibleOnDate: true,
    flexibility: "Any Time",
    travelDate: "2026-08-01",
  };

  it("sends the hot tub keys, with the pet count and Yes/No flags", () => {
    const d = buildEnquirySubmitData(form);
    expect(keysOf(d)).toEqual(
      [
        "title", "holiday_type_id", "notes", "is_test", "budget", "max_budget", "budget_type", "no_of_nights",
        "flexible_nights", "no_of_guests", "no_of_pets", "travel_date", "flexible_date", "weekend_lodge",
        "accomodation_type_id", "destinations",
      ].sort(),
    );
    expect(d).toMatchObject({
      budget: "500",
      max_budget: "900",
      no_of_guests: 4,
      no_of_pets: 2,
      flexible_date: "Yes",
      weekend_lodge: "Yes",
      destinations: ["d1", "d2"],
    });
  });

  it("does not save the flexibility choice (shown only, as before)", () => {
    expect(buildEnquirySubmitData(form)).not.toHaveProperty("flexibility_date");
  });

  it("falls back to the max budget when there is no min, and saves 0 pets as 0", () => {
    const d = buildEnquirySubmitData({ ...form, budget: "", pets: 0, weekendLodge: false, flexibleOnDate: false });
    expect(d).toMatchObject({ budget: "900", no_of_pets: 0, flexible_date: "No", weekend_lodge: "No" });
  });
});

describe("buildEnquirySubmitData: cruise", () => {
  const form: EnquiryForm = {
    ...base,
    holidayTypeName: "Cruise Package",
    destinations: ["d1", "d2"],
    airports: ["ap1"],
    travelDate: "2026-09-01",
    adults: 2,
    children: 1,
    childAges: [7],
    budget: "2000",
    maxBudget: "4000",
    cabinType: "Balcony",
    cruiseLine: "MSC",
    preCruiseDays: "2",
    postCruiseDays: "3",
    flexibility: "Any Time",
  };

  it("sends the cruise keys with a single destination and parsed stay days", () => {
    const d = buildEnquirySubmitData(form);
    expect(keysOf(d)).toEqual(
      [
        "title", "holiday_type_id", "notes", "is_test", "travel_date", "no_of_nights", "flexible_nights", "budget",
        "max_budget", "budget_type", "adults", "children", "infants", "flexibility_date", "cabin_type", "pre_cruise_stay",
        "post_cruise_stay", "destinations", "departureAirports", "passengers",
      ].sort(),
    );
    expect(d).toMatchObject({
      destinations: ["d1"],
      pre_cruise_stay: 2,
      post_cruise_stay: 3,
      cabin_type: "Balcony",
      flexibility_date: "Any Time",
      passengers: [{ type: "child", age: 7 }],
    });
  });

  it("does not save the cruise line (shown only, as before)", () => {
    const d = buildEnquirySubmitData(form);
    expect(JSON.stringify(d)).not.toContain("MSC");
  });
});
