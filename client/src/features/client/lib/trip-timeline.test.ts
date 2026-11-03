import { describe, expect, it } from "vitest";
import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import { buildTripExtras, buildTripStops } from "./trip-timeline";

type Leg = QuoteDisplay["flights"]["outbound"];

const leg = (parts: Partial<Leg> = {}): Leg => ({
  from: "",
  to: "",
  carrier: "",
  flightNo: "",
  depart: "",
  arrive: "",
  departDate: "",
  departTime: "",
  arriveDate: "",
  arriveTime: "",
  ...parts,
});

function display(parts: Partial<QuoteDisplay> = {}): QuoteDisplay {
  const base = {
    packageType: "Package",
    travelDate: "",
    returnDate: "",
    checkInDate: "",
    checkInTime: "",
    nights: 0,
    transferType: "",
    preBookedSeats: "",
    flightMeals: "No",
    destinationName: "Majorca",
    resortName: "",
    countryName: "",
    pets: 0,
    accommodation: { property: "", board: "", roomType: "", notes: "" },
    flights: { outbound: leg(), inbound: leg(), outboundConnecting: [], inboundConnecting: [] },
    transfers: [],
    carHires: [],
    attractionTickets: [],
    loungePasses: [],
    airportParkings: [],
    extraAccommodations: [],
  };
  return { ...base, ...parts } as unknown as QuoteDisplay;
}

const holiday = (parts: Partial<QuoteDisplay> = {}) =>
  display({
    travelDate: "2026-11-02",
    returnDate: "2026-11-09",
    checkInDate: "2026-11-02",
    checkInTime: "15:00",
    nights: 7,
    transferType: "Private",
    resortName: "Alcudia",
    countryName: "Spain",
    accommodation: { property: "Hotel Bahia", board: "All Inclusive", roomType: "Junior Suite", notes: "" },
    flights: {
      outbound: leg({ from: "LGW", to: "PMI", flightNo: "BA2640", departDate: "2026-11-02", departTime: "06:15", arriveDate: "2026-11-02", arriveTime: "09:40" }),
      inbound: leg({ from: "PMI", to: "LGW", flightNo: "BA2641", departDate: "2026-11-09", departTime: "23:10", arriveDate: "2026-11-10", arriveTime: "01:50" }),
      outboundConnecting: [],
      inboundConnecting: [],
    },
    ...parts,
  });

describe("buildTripStops", () => {
  it("orders outbound, transfer, hotel, return", () => {
    const stops = buildTripStops(holiday());
    expect(stops.map((s) => s.kind)).toEqual(["outbound", "transfer", "hotel", "inbound"]);
    expect(stops.map((s) => s.tone)).toEqual(["out", "transfer", "hotel", "return"]);
  });

  it("describes the outbound flight and the hotel", () => {
    const [out, , hotel] = buildTripStops(holiday());
    expect(out).toMatchObject({ title: "LGW → PMI", route: { depart: "06:15", arrive: "09:40" } });
    expect(out!.lines).toContain("BA2640");
    expect(hotel).toMatchObject({ title: "Hotel Bahia", label: "Hotel check-in, 7 nights", pills: ["Junior Suite", "All Inclusive"] });
    expect(hotel!.lines).toContain("Alcudia, Spain");
    expect(hotel!.lines).toContain("7 nights");
  });

  it("flags a return flight that lands the next day", () => {
    const stops = buildTripStops(holiday());
    expect(stops.find((s) => s.kind === "inbound")!.landsNextDay).toBe(true);
    expect(stops.find((s) => s.kind === "outbound")!.landsNextDay).toBeUndefined();
  });

  it("does not flag a same-day return", () => {
    const q = holiday();
    q.flights.inbound.arriveDate = "2026-11-09";
    expect(buildTripStops(q).find((s) => s.kind === "inbound")!.landsNextDay).toBeUndefined();
  });

  it("falls back to the reversed outbound for an empty inbound leg", () => {
    const q = holiday();
    q.flights.inbound = leg();
    const inbound = buildTripStops(q).find((s) => s.kind === "inbound")!;
    expect(inbound.title).toBe("PMI → LGW");
    expect(inbound.sortKey.startsWith("2026-11-09#4")).toBe(true);
  });

  it("numbers connecting flights after the primary legs and sorts them by date", () => {
    const q = holiday();
    q.flights.outboundConnecting = [leg({ from: "PMI", to: "IBZ", departDate: "2026-11-02", departTime: "12:00" })];
    const stops = buildTripStops(q);
    const connecting = stops.find((s) => s.kind === "outbound-connecting")!;
    expect(connecting.label).toBe("Connecting flight 2");
    expect(stops.indexOf(connecting)).toBe(1);
  });

  it("skips the transfer for cruises and adds the embarkation", () => {
    const q = holiday({
      packageType: "Cruise",
      cruise: { cruiseLine: "MSC", ship: "Seaview", cabinType: "Balcony", cabinNumber: "", embarkation: "", debarkation: "", cruiseName: "Med Cruise", cruiseDate: "2026-11-02", preCruiseStay: 0, postCruiseStay: 0, itinerary: [] },
    });
    const kinds = buildTripStops(q).map((s) => s.kind);
    expect(kinds).not.toContain("transfer");
    expect(kinds).toContain("cruise-embarkation");
    expect(buildTripStops(q).find((s) => s.kind === "cruise-embarkation")).toMatchObject({ tone: "cruise", title: "Seaview", pills: ["Balcony"] });
  });

  it("uses the lodge branch for hot tub stays", () => {
    const q = holiday({ packageType: "Hot Tub Lodge", pets: 2, lodge: { name: "Oak", type: "Woodland Lodge", code: "W1" } });
    const stops = buildTripStops(q);
    expect(stops.map((s) => s.kind)).toEqual(["lodge-checkin", "lodge-arrival", "lodge-checkout"]);
    expect(stops[0]).toMatchObject({ tone: "lodge", title: "Woodland Lodge" });
    expect(stops[0]!.lines).toContain("2 pets");
    expect(stops[2]!.sortKey).toBe("2026-11-09T10:00");
  });

  it("sorts additional hotels by their own check-in and adds flight extras last", () => {
    const q = holiday({
      flightMeals: "Yes",
      extraAccommodations: [{ property: "Hotel Two", checkInDate: "2026-11-05", noOfNights: 1, board: "", roomType: "", tourOperatorName: "TUI" }],
    });
    const kinds = buildTripStops(q).map((s) => s.kind);
    expect(kinds).toEqual(["outbound", "transfer", "hotel", "hotel-extra", "inbound", "flight-extras"]);
    expect(buildTripStops(q).find((s) => s.kind === "hotel-extra")!.lines).toContain("1 night");
  });

  it("returns no stops for an empty quote", () => {
    expect(buildTripStops(display())).toEqual([]);
  });
});

describe("buildTripExtras", () => {
  it("is empty when there are no add-ons", () => {
    expect(buildTripExtras(display())).toEqual([]);
  });

  it("builds and sorts the add-ons by their own dates", () => {
    const q = display({
      transfers: [
        { pickUpLocation: "PMI", dropOffLocation: "Hotel", pickUpTime: "2026-11-09T10:00:00", dropOffTime: null, note: null, tourOperatorName: null },
        { pickUpLocation: "PMI", dropOffLocation: "Hotel", pickUpTime: "2026-11-02T10:00:00", dropOffTime: null, note: "Meet at arrivals", tourOperatorName: null },
      ],
      carHires: [{ pickUpLocation: "PMI", dropOffLocation: "PMI", pickUpTime: null, dropOffTime: null, noOfDays: 1, tourOperatorName: "Hertz" }],
      loungePasses: [{ terminal: "5", airportName: "Heathrow", dateOfUsage: "2026-11-02", note: null, tourOperatorName: null }],
    });
    const extras = buildTripExtras(q);
    expect(extras.map((e) => e.kind)).toEqual(["extra-transfer", "extra-transfer", "extra-carhire", "extra-lounge"]);
    expect(extras[0]!.lines).toContain("Meet at arrivals");
    expect(extras[2]!.lines).toContain("1 day");
    expect(extras[3]!.title).toBe("Heathrow · Terminal 5");
    expect(extras.every((e) => e.tone === "extra")).toBe(true);
  });
});
