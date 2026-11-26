import { describe, expect, it } from "vitest";
import type { PortalBookingDetail } from "@shared/portal-bookings";
import { buildJourney } from "./quote-journey";

function booking(over: Partial<PortalBookingDetail> = {}): PortalBookingDetail {
  return {
    id: "b1", title: "Hotel Roma", destinationName: "Rome", countryName: "Italy", resortName: "", travelDate: "2026-12-01", returnDate: "2026-12-08",
    numNights: 7, board: "BB", adults: 2, children: 0, infants: 0, operatorName: null, bookingReference: "HAY-1", supplierReference: "", total: 1000,
    pricePerPerson: 500, tripStatus: "upcoming", daysToGo: 7, flights: [], accommodations: [], transfers: [], carHires: [], attractionTickets: [],
    loungePasses: [], airportParkings: [], cruises: [], extras: [], images: [], agent: { name: "Sam Agent", avatar: null }, ...over,
  };
}

const flight = (over: object) => ({
  flightType: "outbound", flightNumber: "BA1", departingAirport: "Manchester", arrivalAirport: "Rome", departureDateTime: null, arrivalDateTime: null, legOrder: 1, ...over,
});

describe("buildJourney with a booking", () => {
  it("lays out a flight pair, two hotels, a transfer and an extra in date order, the extra last", () => {
    const items = buildJourney(
      booking({
        flights: [
          flight({ flightType: "inbound", flightNumber: "BA2", departingAirport: "Rome", arrivalAirport: "Manchester", departureDateTime: "2026-12-08T14:00:00.000Z", arrivalDateTime: "2026-12-08T17:00:00.000Z" }),
          flight({ departureDateTime: "2026-12-01T07:30:00.000Z", arrivalDateTime: "2026-12-01T11:00:00.000Z" }),
        ],
        accommodations: [
          { name: "Hotel Napoli", boardBasis: "HB", roomType: "Twin", checkInDateTime: "2026-12-04T15:00:00.000Z", resortName: "" },
          { name: "Hotel Roma", boardBasis: "BB", roomType: "Double", checkInDateTime: "2026-12-01T15:00:00.000Z", resortName: "" },
        ],
        transfers: [{ from: "Fiumicino", to: "Hotel Roma", pickUpTime: "2026-12-01T12:00:00.000Z", dropOffTime: null, note: "" }],
        extras: [{ type: "Extra nights", description: "Two extra nights", quantity: 1 }],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["flight-out", "transfer", "hotel", "hotel", "flight-in", "extra"]);
    expect(items[2].title).toBe("Hotel Roma");
    expect(items[3].title).toBe("Hotel Napoli");
    const extra = items.at(-1);
    expect(extra).toMatchObject({ kicker: "Extra nights", title: "Two extra nights", detail: [] });
  });

  it("an extra after a late return flight still comes last, and a quantity is shown", () => {
    const items = buildJourney(
      booking({
        flights: [flight({ flightType: "inbound", departureDateTime: "2026-12-30T10:00:00.000Z" })],
        extras: [{ type: "Extra", description: "Gift", quantity: 3 }],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["flight-in", "extra"]);
    expect(items[1].detail).toEqual(["Quantity 3"]);
  });

  it("does not number the hotel's nights when the length is unknown", () => {
    const items = buildJourney(booking({ numNights: null, returnDate: null, accommodations: [{ name: "Hotel Roma", boardBasis: "", roomType: "", checkInDateTime: null, resortName: "" }] }));
    expect(items[0].kicker).toBe("Hotel");
  });

  it("a booking with nothing in it has an empty journey", () => {
    expect(buildJourney(booking())).toEqual([]);
  });
});
