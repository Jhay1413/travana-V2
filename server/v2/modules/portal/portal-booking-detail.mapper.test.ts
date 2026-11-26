import { describe, it, expect } from "vitest";
import { buildBookingDetail, buildExtras, tripTiming, type BookingDetailSource } from "./portal-booking-detail.mapper";

const header = {
  bookingId: "b1", quoteId: "q1", title: "Hotel Roma", haysRef: "HAY-1234567", supplierRef: "OP-98765",
  salesPrice: "2400.00", discounts: "100.00", serviceCharge: "50.00", extrasTotal: 50, adult: 2, child: 0, infant: 0,
  travelDate: "2026-12-01", numNights: 7, operatorName: "Sun Holidays", boardName: "All Inclusive",
  destinationName: "Rome", countryName: "Italy", resortName: "Lazio", agentFirstName: "Sam", agentLastName: "Agent", agentAvatar: null,
};

const source = (over: Partial<BookingDetailSource> = {}): BookingDetailSource => ({
  header, flights: [], accommodations: [], transfers: [], carHires: [], tickets: [], lounges: [], parkings: [], cruises: [], upsells: [], images: [], ...over,
});

const NOW = new Date("2026-11-24T12:00:00Z");

describe("tripTiming (UK calendar day)", () => {
  it("is upcoming before the first day, with whole days to go", () => {
    expect(tripTiming("2026-12-01", "2026-12-08", NOW)).toEqual({ status: "upcoming", daysToGo: 7 });
  });

  it("is in progress from the first day to the last day inclusive", () => {
    expect(tripTiming("2026-12-01", "2026-12-08", new Date("2026-12-01T09:00:00Z")).status).toBe("in_progress");
    expect(tripTiming("2026-12-01", "2026-12-08", new Date("2026-12-08T22:00:00Z")).status).toBe("in_progress");
    expect(tripTiming("2026-12-01", "2026-12-08", new Date("2026-12-09T00:30:00Z")).status).toBe("past");
  });

  it("a trip with no recorded length is a one-day trip", () => {
    expect(tripTiming("2026-12-01", null, new Date("2026-12-01T10:00:00Z")).status).toBe("in_progress");
    expect(tripTiming("2026-12-01", null, new Date("2026-12-02T10:00:00Z")).status).toBe("past");
  });

  it("follows the UK day, not UTC, in summer (BST): 23:30 UTC on 14 Jun is already 15 Jun in London", () => {
    expect(tripTiming("2026-06-15", "2026-06-20", new Date("2026-06-14T23:30:00Z"))).toEqual({ status: "in_progress", daysToGo: 0 });
    expect(tripTiming("2026-06-15", "2026-06-20", new Date("2026-06-14T22:30:00Z"))).toEqual({ status: "upcoming", daysToGo: 1 });
  });

  it("counts whole days across both clock changes", () => {
    // Clocks go forward on 29 Mar 2026 and back on 25 Oct 2026: the counts are still calendar days.
    expect(tripTiming("2026-04-05", null, new Date("2026-03-27T12:00:00Z")).daysToGo).toBe(9);
    expect(tripTiming("2026-11-01", null, new Date("2026-10-20T12:00:00Z")).daysToGo).toBe(12);
    expect(tripTiming("2026-10-26", "2026-10-30", new Date("2026-10-25T23:30:00Z"))).toEqual({ status: "upcoming", daysToGo: 1 });
    expect(tripTiming("2026-10-26", "2026-10-30", new Date("2026-10-26T00:30:00Z")).status).toBe("in_progress");
    expect(tripTiming("2026-03-29", null, new Date("2026-03-28T23:30:00Z"))).toEqual({ status: "upcoming", daysToGo: 1 });
  });
});

describe("buildBookingDetail", () => {
  it("keeps the two references separate and gives the list's price", () => {
    const d = buildBookingDetail(source(), NOW);
    expect(d.bookingReference).toBe("HAY-1234567");
    expect(d.supplierReference).toBe("OP-98765");
    // 2400 - 100 + 50 + 50 extras = 2,400; per person 1,200.
    expect(d.total).toBe(2400);
    expect(d.pricePerPerson).toBe(1200);
    expect(d).toMatchObject({ numNights: 7, returnDate: "2026-12-08", board: "All Inclusive", operatorName: "Sun Holidays", tripStatus: "upcoming", daysToGo: 7 });
  });

  it("gives null nights and no end date when no length is recorded (never invented)", () => {
    const d = buildBookingDetail(source({ header: { ...header, numNights: 0 } }), NOW);
    expect(d.numNights).toBeNull();
    expect(d.returnDate).toBeNull();
  });

  it("maps every itinerary item type", () => {
    const d = buildBookingDetail(
      source({
        flights: [
          { flightType: "outbound", flightNumber: "BA1", departingAirport: "Manchester (MAN)", arrivalAirport: "Rome (FCO)", departureDateTime: new Date("2026-12-01T07:30:00Z"), arrivalDateTime: "2026-12-01T11:00:00Z" },
          { flightType: "inbound", flightNumber: "BA2", departingAirport: "Rome (FCO)", arrivalAirport: "Manchester (MAN)", departureDateTime: null, arrivalDateTime: null },
        ],
        accommodations: [
          { name: "Hotel Roma", boardBasis: "BB", roomType: "Double", checkInDateTime: "2026-12-01T15:00:00Z", resortName: "Lazio", isPrimary: true },
          { name: "Hotel Napoli", boardBasis: null, roomType: null, checkInDateTime: null, resortName: null, isPrimary: false },
        ],
        transfers: [{ pickUp: "Fiumicino", dropOff: "Hotel Roma", pickUpTime: "2026-12-01T12:00:00Z", dropOffTime: null }],
        carHires: [{ pickUp: "Rome", dropOff: "Rome", pickUpTime: "2026-12-02T09:00:00Z", dropOffTime: null, numDays: 2 }],
        tickets: [{ ticketType: "Colosseum", dateOfVisit: "2026-12-03T10:00:00Z", numberOfTickets: 2 }],
        lounges: [{ airportName: "Manchester (MAN)", terminal: "2", dateOfUsage: "2026-12-01T05:00:00Z" }],
        parkings: [{ airportName: "Manchester (MAN)", parkingType: "Meet and greet", parkingDate: "2026-11-30T20:00:00Z" }],
        cruises: [{ cruiseLine: "Costa", ship: "Smeralda", cabinType: "Balcony", cruiseName: "Med", cruiseDate: "2026-12-05", itinerary: [{ day: 1, description: "Naples", subDescription: null }] }],
        upsells: [{ upsellType: "EXTRA_NIGHTS", description: "2 extra nights", quantity: 1 }],
      }),
      NOW,
    );
    expect(d.flights).toEqual([
      { flightType: "outbound", flightNumber: "BA1", departingAirport: "Manchester (MAN)", arrivalAirport: "Rome (FCO)", departureDateTime: "2026-12-01T07:30:00.000Z", arrivalDateTime: "2026-12-01T11:00:00.000Z", legOrder: 1 },
      { flightType: "inbound", flightNumber: "BA2", departingAirport: "Rome (FCO)", arrivalAirport: "Manchester (MAN)", departureDateTime: null, arrivalDateTime: null, legOrder: 1 },
    ]);
    expect(d.accommodations).toHaveLength(2);
    expect(d.accommodations[1]).toEqual({ name: "Hotel Napoli", boardBasis: "", roomType: "", checkInDateTime: null, resortName: "" });
    expect(d.transfers).toEqual([{ from: "Fiumicino", to: "Hotel Roma", pickUpTime: "2026-12-01T12:00:00.000Z", dropOffTime: null, note: "" }]);
    expect(d.carHires[0]).toMatchObject({ pickupLocation: "Rome", numDays: 2 });
    expect(d.attractionTickets[0]).toEqual({ type: "Colosseum", dateOfVisit: "2026-12-03T10:00:00.000Z", numberOfTickets: 2 });
    expect(d.loungePasses[0]).toEqual({ airportName: "Manchester (MAN)", terminal: "2", dateOfUsage: "2026-12-01T05:00:00.000Z", note: "" });
    expect(d.airportParkings[0]).toMatchObject({ parkingType: "Meet and greet" });
    expect(d.cruises[0]).toEqual({ cruiseLine: "Costa", ship: "Smeralda", cabinType: "Balcony", cruiseName: "Med", cruiseDate: "2026-12-05", itinerary: [{ day: 1, description: "Naples", subDescription: "" }] });
    expect(d.extras).toEqual([{ type: "Extra nights", description: "2 extra nights", quantity: 1 }]);
  });

  it("numbers flight legs within their own direction", () => {
    const leg = (flightType: string) => ({ flightType, flightNumber: null, departingAirport: "A", arrivalAirport: "B", departureDateTime: null, arrivalDateTime: null });
    const d = buildBookingDetail(source({ flights: [leg("outbound"), leg("outbound"), leg("inbound")] }), NOW);
    expect(d.flights.map((f) => f.legOrder)).toEqual([1, 2, 1]);
  });

  it("the agent is a name and an avatar only, with a generic name when there is none", () => {
    expect(buildBookingDetail(source(), NOW).agent).toEqual({ name: "Sam Agent", avatar: null });
    expect(buildBookingDetail(source({ header: { ...header, agentFirstName: null, agentLastName: null } }), NOW).agent.name).toBe("Your Travel Agent");
  });

  it("never carries cost, commission, notes, staff ids or names, at any depth", () => {
    // A source row that (wrongly) carried cost-side and name fields: none of it may come out.
    const tainted = source({
      header: { ...header, cost: "900", commission: "120", supplierCost: "800", userId: "u1", clientId: "c1", transactionId: "t1", internalNotes: "pay by card" } as never,
      flights: [{ flightType: "outbound", flightNumber: "BA1", departingAirport: "A", arrivalAirport: "B", departureDateTime: null, arrivalDateTime: null, cost: "10", commission: "2", flightRef: "X" } as never],
      transfers: [{ pickUp: "A", dropOff: "B", pickUpTime: null, dropOffTime: null, cost: "5", commission: "1", note: "staff note", bookingRef: "R" } as never],
      lounges: [{ airportName: "A", terminal: "1", dateOfUsage: null, note: "staff note", cost: "9" } as never],
      upsells: [{ upsellType: "OTHER", description: "x", quantity: 1, cost: "3", commission: "1", salesPrice: "9" } as never],
    });
    const json = JSON.stringify(buildBookingDetail(tainted, NOW));
    const keys = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        for (const [k, child] of Object.entries(v)) {
          keys.add(k);
          walk(child);
        }
      }
    };
    walk(JSON.parse(json));
    for (const k of keys) {
      expect(k, k).not.toMatch(/cost|commission|salesPrice|discounts|serviceCharge|userId|clientId|transactionId|notes|supplierCost|firstName|lastName|surname|passenger|flightRef|booking_ref|bookingRef(?!erence)/i);
    }
    for (const secret of ["pay by card", "staff note", "u1", "t1"]) expect(json).not.toContain(secret);
  });
});

describe("buildExtras", () => {
  it("lists the customer-facing extras and drops the agency's own FEE lines", () => {
    expect(
      buildExtras([
        { upsellType: "PARKING", description: "Week of parking", quantity: 1 },
        { upsellType: "FEE", description: "Amendment fee", quantity: 1 },
        { upsellType: "LOUNGE", description: null, quantity: 0 },
        { upsellType: "SOMETHING_NEW", description: "x", quantity: 1 },
      ]),
    ).toEqual([
      { type: "Airport parking", description: "Week of parking", quantity: 1 },
      { type: "Airport lounge", description: "", quantity: 1 },
    ]);
  });
});
