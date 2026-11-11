import { describe, expect, it } from "vitest";
import { buildTripExtras, buildTripStops } from "./trip-timeline";
import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import { mergeTripItems } from "./trip-sort";
import type { TripStop } from "./trip-types";

const stop = (id: string, sortKey: string): TripStop => ({ id, kind: id, tone: "extra", icon: "plane", label: "", title: id, lines: [], pills: [], sortKey });

describe("mergeTripItems", () => {
  it("interleaves extras by sort key", () => {
    const out = mergeTripItems([stop("flight", "2026-06-01#0#07:10"), stop("hotel", "2026-06-01#3#14:00")], [stop("tkt", "2026-06-01#6#00:00")]);
    expect(out.map((s) => s.id)).toEqual(["flight", "hotel", "tkt"]);
  });

  it("puts pre-departure extras before the flight on the same day", () => {
    const out = mergeTripItems([stop("flight", "2026-06-01#0#07:10")], [stop("park", "2026-06-01#-#00:00")]);
    expect(out.map((s) => s.id)).toEqual(["park", "flight"]);
  });

  it("puts undated extras last in their original order", () => {
    const out = mergeTripItems([stop("flight", "2026-06-01#0#07:10"), stop("fx", "9999-12-31#9#23:59")], [stop("u1", ""), stop("d", "2026-05-30#-#00:00"), stop("u2", "")]);
    expect(out.map((s) => s.id)).toEqual(["d", "flight", "fx", "u1", "u2"]);
  });
});

describe("hot tub lodge stops with extras", () => {
  it("keeps same-day extras after Lodge check-in", () => {
    const q = {
      packageType: "Hot Tub Break", travelDate: "2026-06-01", checkInDate: "2026-06-01", returnDate: "2026-06-04", nights: 3, pets: 0,
      accommodation: { property: "", board: "", roomType: "", notes: "" },
      transfers: [], carHires: [], attractionTickets: [{ dateOfVisit: "2026-06-01", numberOfTickets: 2, ticketType: "Zoo", tourOperatorName: null }],
      loungePasses: [], airportParkings: [], extraAccommodations: [],
    } as unknown as QuoteDisplay;
    const out = mergeTripItems(buildTripStops(q), buildTripExtras(q));
    expect(out.map((s) => s.kind)).toEqual(["lodge-checkin", "extra-ticket", "lodge-checkout"]);
  });
});

describe("arrival-day airport transfer", () => {
  it("sits between the flight and hotel check-in", () => {
    const q = {
      packageType: "Package", travelDate: "2026-06-01", checkInDate: "2026-06-01", checkInTime: "14:00", returnDate: "", nights: 0, transferType: "",
      destinationName: "X", flightMeals: "No", preBookedSeats: "",
      accommodation: { property: "Hotel", board: "", roomType: "", notes: "" },
      flights: { outbound: { from: "LGW", to: "PMI", departDate: "2026-06-01", departTime: "06:00" }, inbound: { from: "", to: "" }, outboundConnecting: [], inboundConnecting: [] },
      transfers: [{ pickUpLocation: "Palma Airport", dropOffLocation: "Hotel", pickUpTime: "2026-06-01T10:30", dropOffTime: null, note: null, tourOperatorName: null }],
      carHires: [], attractionTickets: [], loungePasses: [], airportParkings: [], extraAccommodations: [],
    } as unknown as QuoteDisplay;
    const out = mergeTripItems(buildTripStops(q), buildTripExtras(q));
    expect(out.map((s) => s.kind)).toEqual(["outbound", "extra-transfer", "hotel"]);
  });
});
