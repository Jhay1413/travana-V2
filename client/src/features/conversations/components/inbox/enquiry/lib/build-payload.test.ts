import { describe, expect, it } from "vitest";
import { buildInboxEnquiryPayload } from "./build-payload";
import { DEFAULT_FORM, type EnquiryForm } from "./enquiry-form";

const opts = { clientId: "client1", userId: "agent2", leadSource: "WHATSAPP" } as const;

const full: EnquiryForm = {
  ...DEFAULT_FORM,
  title: " Lanzarote week ",
  holidayType: "pt1",
  holidayTypeName: "Package Holiday",
  destinations: ["d1"],
  resorts: ["r1"],
  airports: ["a1"],
  travelDate: "2026-07-01",
  flexibility: "+/- 3 Days",
  nights: 7,
  adults: 2,
  children: 1,
  childAges: [6],
  budget: "3000",
  boardBasis: ["b1"],
  starRating: "4 Star",
  notes: "Kids club",
};

// JSON drops undefined, which is what actually goes over the wire.
const keysOf = (o: object) => Object.keys(JSON.parse(JSON.stringify(o)) as object).sort();

describe("buildInboxEnquiryPayload", () => {
  it("sets the client, assignee and lead source", () => {
    const p = buildInboxEnquiryPayload(full, opts);
    expect(p).toMatchObject({ client_id: "client1", user_id: "agent2", lead_source: "WHATSAPP", is_test: false });
  });

  it("submits the wizard's key set for a package holiday", () => {
    const e = buildInboxEnquiryPayload(full, opts).enquiry ?? {};
    expect(keysOf(e)).toEqual(
      [
        "title", "holiday_type_id", "notes", "travel_date", "adults", "children", "infants", "no_of_nights",
        "flexible_nights", "budget", "budget_type", "accom_min_star_rating", "flexibility_date", "status",
        "destinations", "resorts", "boardBases", "departureAirports", "passengers",
      ].sort(),
    );
    expect(e).toMatchObject({
      title: "Lanzarote week",
      destinations: ["d1"],
      resorts: ["r1"],
      boardBases: ["b1"],
      departureAirports: ["a1"],
      passengers: [{ type: "child", age: 6 }],
      flexible_nights: [7],
      status: "ACTIVE",
    });
  });

  it("submits the wizard's key set for a hot tub break", () => {
    const hot: EnquiryForm = {
      ...full,
      holidayTypeName: "Hot Tub Break",
      accommodationType: "at1",
      guests: 4,
      weekendLodge: true,
      flexibleOnDate: true,
    };
    const e = buildInboxEnquiryPayload(hot, opts).enquiry ?? {};
    expect(keysOf(e)).toEqual(
      [
        "title", "holiday_type_id", "notes", "budget", "budget_type", "no_of_nights", "flexible_nights",
        "no_of_guests", "travel_date", "flexible_date", "weekend_lodge", "accomodation_type_id", "destinations",
        "status",
      ].sort(),
    );
    expect(e).toMatchObject({ no_of_guests: 4, weekend_lodge: "Yes", flexible_date: "Yes", accomodation_type_id: "at1" });
  });

  it("sends no_of_pets 1 for a hot tub when pets is Yes", () => {
    const hot: EnquiryForm = { ...full, holidayTypeName: "Hot Tub Break", pets: "Yes" };
    expect(buildInboxEnquiryPayload(hot, opts).enquiry?.no_of_pets).toBe(1);
  });

  it("submits the wizard's key set for a cruise package", () => {
    const cruise: EnquiryForm = {
      ...full,
      holidayTypeName: "Cruise Package",
      cabinType: "Balcony",
      preCruiseDays: "2",
      postCruiseDays: "3",
    };
    const e = buildInboxEnquiryPayload(cruise, opts).enquiry ?? {};
    expect(keysOf(e)).toEqual(
      [
        "title", "holiday_type_id", "notes", "travel_date", "no_of_nights", "flexible_nights", "budget",
        "budget_type", "adults", "children", "infants", "cabin_type", "pre_cruise_stay", "post_cruise_stay",
        "destinations", "departureAirports", "passengers", "flexibility_date", "status",
      ].sort(),
    );
    expect(e).toMatchObject({ cabin_type: "Balcony", pre_cruise_stay: 2, post_cruise_stay: 3 });
  });

  it("omits empty optional values", () => {
    const e = buildInboxEnquiryPayload(
      { ...DEFAULT_FORM, title: "T", holidayType: "pt1", holidayTypeName: "Package Holiday" },
      opts,
    ).enquiry ?? {};
    expect(keysOf(e)).toEqual(
      ["title", "holiday_type_id", "adults", "children", "infants", "no_of_nights", "flexible_nights", "budget_type", "status"].sort(),
    );
  });
});
