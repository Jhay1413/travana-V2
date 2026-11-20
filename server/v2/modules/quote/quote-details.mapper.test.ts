import { describe, it, expect } from "vitest";
import { buildFreeSocialCopyInput, mapChildAgesFromDetails, mapQuoteExtrasFromDetails } from "./quote-details.mapper";

describe("quote-details.mapper", () => {
  it("mapQuoteExtrasFromDetails drops ids and keeps only non-primary accommodations as extras", () => {
    const out = mapQuoteExtrasFromDetails({
      transfers: [{ id: "t1", quote_id: "q", pick_up_location: "A", cost: "5" }],
      accommodations: [{ id: "a1", is_primary: true, accomodation_id: "p" }, { id: "a2", is_primary: false, accomodation_id: "x", no_of_nights: 3 }],
    });
    expect(out.transfers).toEqual([expect.objectContaining({ pick_up_location: "A", cost: "5" })]);
    expect(out.transfers[0]).not.toHaveProperty("id");
    expect(out.extraAccommodations).toHaveLength(1);
    expect(out.extraAccommodations[0]).toMatchObject({ accomodation_id: "x", no_of_nights: 3 });
    expect(out.carHires).toEqual([]);
  });

  it("mapChildAgesFromDetails returns only child ages", () => {
    expect(mapChildAgesFromDetails({ passengers: [{ type: "child", age: 4 }, { type: "adult", age: 30 }, { type: "child", age: "9" }] })).toEqual([4, 9]);
    expect(mapChildAgesFromDetails({})).toEqual([]);
  });

  it("buildFreeSocialCopyInput whitelists quote columns and never carries identity fields", () => {
    const { quoteFields } = buildFreeSocialCopyInput(
      {
        transaction_id: "t1", id: "q1", quote_token: "tok", parent_quote_id: "p", accepted_at: new Date(), show_on_portal: true,
        holiday_type_id: "ht", travel_date: "2027-01-01", quote_type: "package", sales_price: "10", title: "T",
      },
      {},
      [],
    );
    expect(quoteFields).toMatchObject({ transaction_id: "t1", holiday_type_id: "ht", title: "T", not_for_social: false });
    for (const key of ["id", "quote_token", "parent_quote_id", "accepted_at", "show_on_portal"]) {
      expect(quoteFields).not.toHaveProperty(key);
    }
  });

  it("buildFreeSocialCopyInput splits flights into legs, strips ids, and rebuilds cruise data", () => {
    const { sections } = buildFreeSocialCopyInput(
      { transaction_id: "t1" },
      {
        flights: [
          { id: "1", quote_id: "q", flight_type: "outbound", leg_order: 2, flight_number: "B" },
          { id: "2", quote_id: "q", flight_type: "outbound", leg_order: 0, flight_number: "A" },
          { id: "3", quote_id: "q", flight_type: "outbound", leg_order: 1, flight_number: "C" },
          { id: "4", quote_id: "q", flight_type: "inbound", leg_order: 0, flight_number: "D" },
        ],
        cruises: [{ cruise_name: "N", ship: "S", extras: [{ name: "a" }, { name: "b" }], itinerary: [{ day_number: 2, description: "d", sub_description: "s" }] }],
        tags: ["t"],
      },
      ["u1"],
    );
    expect(sections.outboundFlight).toEqual({ flight_type: "outbound", flight_number: "A" });
    expect(sections.outboundConnectingLegs.map((l) => l.flight_number)).toEqual(["C", "B"]);
    expect(sections.inboundFlight).toMatchObject({ flight_number: "D" });
    expect(sections.inboundConnectingLegs).toEqual([]);
    expect(sections.cruiseData).toMatchObject({ cruiseTitle: "N", shipName: "S", cruiseExtras: "a, b", cruiseItinerary: [{ day: 2, description: "d", subDescription: "s" }] });
    expect(sections.normalizedImages).toEqual(["u1"]);
    expect(sections.tags).toEqual(["t"]);
  });

  it("buildFreeSocialCopyInput gives no cruise data when the quote has no cruise", () => {
    expect(buildFreeSocialCopyInput({ transaction_id: "t1" }, {}, []).sections.cruiseData).toBeNull();
  });
});
