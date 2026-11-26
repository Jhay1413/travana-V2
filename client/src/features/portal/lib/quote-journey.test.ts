import { describe, expect, it } from "vitest";
import { NO_DECISION, type PortalQuoteDetail } from "@shared/portal-quotes";
import { buildJourney } from "./quote-journey";

function quote(over: Partial<PortalQuoteDetail> = {}): PortalQuoteDetail {
  return {
    id: "q1", token: "T", title: "Rome", holidayType: "", travelDate: "2026-12-01", returnDate: "2026-12-08", numNights: 7,
    adults: 2, children: 0, infants: 0, pets: 0, total: 1000, pricePerPerson: 500, operatorName: null, expiryDate: null, sentAt: null,
    destinationName: "Rome", countryName: "Italy", resortName: "", transferType: "none", flightMeals: false, preBookedSeats: "", tags: [],
    flights: [], accommodations: [], transfers: [], carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], cruises: [],
    images: [], destinationGuide: null, agent: { name: "Sam Agent", avatar: null }, canDecide: true, decision: { ...NO_DECISION },
    ...over,
  };
}

const flight = (over: object) => ({
  flightType: "outbound", flightNumber: "BA1", departingAirport: "Manchester", arrivalAirport: "Rome", departureDateTime: null,
  arrivalDateTime: null, legOrder: 1, ...over,
});

describe("buildJourney", () => {
  it("renders every item type the quote has, in date order", () => {
    const items = buildJourney(
      quote({
        flights: [
          flight({ flightType: "inbound", flightNumber: "BA2", departingAirport: "Rome", arrivalAirport: "Manchester", departureDateTime: "2026-12-08T14:00:00.000Z", arrivalDateTime: "2026-12-08T17:00:00.000Z" }),
          flight({ departureDateTime: "2026-12-01T07:30:00.000Z", arrivalDateTime: "2026-12-01T11:00:00.000Z" }),
        ],
        transfers: [{ from: "Fiumicino", to: "Hotel Roma", pickUpTime: "2026-12-01T12:00:00.000Z", dropOffTime: null, note: "Meet at arrivals" }],
        accommodations: [
          { name: "Hotel Roma", boardBasis: "BB", roomType: "Double", checkInDateTime: "2026-12-01T15:00:00.000Z", resortName: "" },
          { name: "Hotel Napoli", boardBasis: "HB", roomType: "Twin", checkInDateTime: "2026-12-04T15:00:00.000Z", resortName: "" },
        ],
        cruises: [{ cruiseLine: "Costa", ship: "Smeralda", cabinType: "Balcony", cruiseName: "Med Cruise", cruiseDate: "2026-12-05", itinerary: [{ day: 1, description: "Naples", subDescription: "" }] }],
        carHires: [{ pickupLocation: "Rome", dropoffLocation: "Rome", pickupTime: "2026-12-02T09:00:00.000Z", dropoffTime: null, numDays: 2 }],
        attractionTickets: [{ type: "Colosseum", dateOfVisit: "2026-12-03T10:00:00.000Z", numberOfTickets: 2 }],
        loungePasses: [{ airportName: "Manchester (MAN)", terminal: "2", dateOfUsage: "2026-12-01T05:00:00.000Z", note: "" }],
        airportParkings: [{ airportName: "Manchester (MAN)", parkingType: "Meet and greet", parkingDate: "2026-11-30T20:00:00.000Z" }],
      }),
    );
    expect(items.map((i) => i.key)).toEqual([
      "parking-0", // 30 Nov, evening before
      "lounge-0", // 1 Dec 05:00
      "flight-1", // outbound 07:30
      "transfer-0", // 12:00
      "hotel-0", // 15:00
      "car-0", // 2 Dec
      "ticket-0", // 3 Dec
      "hotel-1", // 4 Dec
      "cruise-0", // 5 Dec
      "flight-0", // return 8 Dec
    ]);
    expect(new Set(items.map((i) => i.kind))).toEqual(new Set(["parking", "lounge", "flight-out", "transfer", "hotel", "car-hire", "tickets", "cruise", "flight-in"]));
  });

  it("an item with no date is placed by what it is: outward items first, the return flight last", () => {
    const items = buildJourney(
      quote({
        flights: [flight({ flightType: "inbound", departingAirport: "Rome", arrivalAirport: "Manchester" }), flight({})],
        accommodations: [{ name: "Hotel Roma", boardBasis: "", roomType: "", checkInDateTime: null, resortName: "" }],
        transfers: [{ from: "", to: "", pickUpTime: null, dropOffTime: null, note: "" }],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["flight-out", "transfer", "hotel", "flight-in"]);
  });

  it("a dated extra falls between the flights even though it comes later in the data", () => {
    const items = buildJourney(
      quote({
        flights: [
          flight({ departureDateTime: "2026-12-01T07:00:00.000Z", arrivalDateTime: "2026-12-01T10:00:00.000Z" }),
          flight({ flightType: "inbound", departureDateTime: "2026-12-08T14:00:00.000Z", arrivalDateTime: "2026-12-08T17:00:00.000Z" }),
        ],
        attractionTickets: [{ type: "Vatican", dateOfVisit: "2026-12-05T09:00:00.000Z", numberOfTickets: 1 }],
      }),
    );
    expect(items.map((i) => i.kind)).toEqual(["flight-out", "tickets", "flight-in"]);
  });

  it("labels flight legs and flags a landing on the next day", () => {
    const items = buildJourney(
      quote({
        flights: [
          flight({ legOrder: 1, departureDateTime: "2026-12-01T20:00:00.000Z", arrivalDateTime: "2026-12-02T06:30:00.000Z" }),
          flight({ legOrder: 2, departureDateTime: "2026-12-02T08:00:00.000Z", arrivalDateTime: "2026-12-02T10:00:00.000Z" }),
        ],
      }),
    );
    expect(items[0].kicker).toBe("Outbound flight, leg 1");
    expect(items[1].kicker).toBe("Outbound flight, leg 2");
    expect(items[0].flight).toMatchObject({ dep: "20:00", arr: "06:30", nextDay: true });
    expect(items[0].detail).toContain("Lands the next day");
    expect(items[1].flight?.nextDay).toBe(false);
  });

  it("a single hotel says how many nights; several hotels just say Hotel", () => {
    const one = buildJourney(quote({ accommodations: [{ name: "A", boardBasis: "", roomType: "", checkInDateTime: null, resortName: "" }] }));
    expect(one[0].kicker).toBe("Hotel, 7 nights");
    const two = buildJourney(
      quote({
        accommodations: [
          { name: "A", boardBasis: "", roomType: "", checkInDateTime: null, resortName: "" },
          { name: "B", boardBasis: "", roomType: "", checkInDateTime: null, resortName: "" },
        ],
      }),
    );
    expect(two.map((i) => i.kicker)).toEqual(["Hotel", "Hotel"]);
  });

  it("a cruise lists its itinerary days; a quote with nothing in it has an empty journey", () => {
    const [cruise] = buildJourney(
      quote({ cruises: [{ cruiseLine: "Costa", ship: "Smeralda", cabinType: "Balcony", cruiseName: "", cruiseDate: "2026-12-05", itinerary: [{ day: 1, description: "Naples", subDescription: "Port" }] }] }),
    );
    expect(cruise.title).toBe("Smeralda");
    expect(cruise.detail).toContain("Day 1: Naples, Port");
    expect(buildJourney(quote())).toEqual([]);
  });

  it("keeps the data order for items on the same day and time", () => {
    const items = buildJourney(
      quote({
        attractionTickets: [
          { type: "B", dateOfVisit: "2026-12-03T10:00:00.000Z", numberOfTickets: 1 },
          { type: "A", dateOfVisit: "2026-12-03T10:00:00.000Z", numberOfTickets: 1 },
        ],
      }),
    );
    expect(items.map((i) => i.title)).toEqual(["B", "A"]);
  });
});
