import { describe, expect, it } from "vitest";
import type { EnquiryTable } from "@/features/quote/types";
import { enquiryToForm } from "./enquiry-from-record";

const record = (over: Partial<EnquiryTable> = {}): EnquiryTable =>
  ({
    id: "e1",
    transaction_id: "t1",
    holiday_type_id: "pt1",
    holiday_type_name: "Package Holiday",
    title: "Lanzarote week",
    adults: 2,
    children: 2,
    infants: 0,
    no_of_nights: 7,
    flexible_nights: null,
    budget: "3000",
    max_budget: null,
    budget_type: null,
    travel_date: "2026-07-01",
    flexibility_date: "+ 3 Days",
    flexible_date: null,
    weekend_lodge: null,
    accom_min_star_rating: "4 Star",
    no_of_guests: null,
    no_of_pets: null,
    pre_cruise_stay: null,
    post_cruise_stay: null,
    cabin_type: null,
    accomodation_type_id: null,
    ...over,
  }) as EnquiryTable;

describe("enquiryToForm", () => {
  it("maps scalars and falls back to the form defaults", () => {
    const f = enquiryToForm(record());
    expect(f).toMatchObject({
      title: "Lanzarote week",
      holidayType: "pt1",
      holidayTypeName: "Package Holiday",
      travelDate: "2026-07-01",
      flexibility: "+ 3 Days",
      adults: 2,
      budget: "3000",
      budgetType: "Per Person",
      starRating: "4 Star",
      guests: 2,
      pets: 0,
      weekendLodge: false,
      flexibleOnDate: false,
      isTest: false,
      notes: "",
    });
  });

  it("maps the stored budget_type enum back to the chip labels (regression)", () => {
    expect(enquiryToForm(record({ budget_type: "PACKAGE" } as Partial<EnquiryTable>)).budgetType).toBe("Package");
    expect(enquiryToForm(record({ budget_type: "PER_PERSON" } as Partial<EnquiryTable>)).budgetType).toBe("Per Person");
    expect(enquiryToForm(record({ budget_type: "Package" } as Partial<EnquiryTable>)).budgetType).toBe("Package");
  });

  it("uses flexible_nights, else the single night count", () => {
    expect(enquiryToForm(record({ flexible_nights: [7, 10] })).flexibleNights).toEqual(["7", "10"]);
    expect(enquiryToForm(record()).flexibleNights).toEqual(["7"]);
    expect(enquiryToForm(record({ no_of_nights: null })).flexibleNights).toEqual([]);
  });

  it("reads child ages from the passengers and pads to the child count", () => {
    const f = enquiryToForm(
      record({
        passengers: [
          { type: "adult", age: 40 },
          { type: "child", age: 6 },
        ],
      }),
    );
    expect(f.childAges).toEqual([6, 0]);
  });

  it("reads related ids and the labels it knows", () => {
    const f = enquiryToForm(
      record({
        destinations: [{ id: "x", enquiry_id: "e1", destination_id: "d1", destination_name: "Lanzarote", country_id: "c1" } as never],
        resorts: [{ id: "x", enquiry_id: "e1", resorts_id: "r1", resort_name: "Costa Teguise" }],
        accommodations: [{ id: "x", enquiry_id: "e1", accomodation_id: "a1", accomodation_name: "Hotel Sol" }],
        boardBases: [{ id: "x", enquiry_id: "e1", board_basis_id: "b1" }],
        airports: [{ id: "x", enquiry_id: "e1", airport_id: "ap1", airport_name: "Manchester" }],
      }),
    );
    expect(f).toMatchObject({
      destinations: ["d1"],
      countries: ["c1"],
      resorts: ["r1"],
      accommodations: ["a1"],
      boardBasis: ["b1"],
      airports: ["ap1"],
      countryOf: { d1: "c1" },
    });
    expect(f.labels).toMatchObject({ d1: "Lanzarote", r1: "Costa Teguise", a1: "Hotel Sol", ap1: "Manchester" });
  });

  it("keeps resorts from the server's resorts_id shape (regression)", () => {
    const f = enquiryToForm(record({ resorts: [{ id: "x", enquiry_id: "e1", resorts_id: "r9", resort_name: "Playa" }] }));
    expect(f.resorts).toEqual(["r9"]);
    expect(f.labels.r9).toBe("Playa");
  });

  it("maps the hot tub and cruise fields", () => {
    const f = enquiryToForm(
      record({
        weekend_lodge: "Yes",
        flexible_date: "Yes",
        no_of_pets: 2,
        no_of_guests: 5,
        max_budget: "900",
        cabin_type: "Suite",
        pre_cruise_stay: 2,
        post_cruise_stay: 4,
        accomodation_type_id: "at1",
      }),
    );
    expect(f).toMatchObject({
      weekendLodge: true,
      flexibleOnDate: true,
      pets: 2,
      guests: 5,
      maxBudget: "900",
      cabinType: "Suite",
      preCruiseDays: "2",
      postCruiseDays: "4",
      accommodationType: "at1",
    });
  });

  it("prefills a cruise flexibility from the saved record", () => {
    const f = enquiryToForm(record({ holiday_type_name: "Cruise Package", flexibility_date: "Any Time" }));
    expect(f.flexibility).toBe("Any Time");
  });

  it("does not treat the hot tub Yes/No in flexible_date as a flexibility choice", () => {
    expect(enquiryToForm(record({ flexibility_date: null, flexible_date: "Yes" })).flexibility).toBe("");
    expect(enquiryToForm(record({ flexibility_date: null, flexible_date: "+ 7 Days" })).flexibility).toBe("+ 7 Days");
  });
});
