import { describe, expect, it } from "vitest";
import { mapScraperJsonToFormFields, type ScraperJson } from "@/lib/scraper-json-parser";

// A picked flights section can yield N legs (a connection). The importer must
// put the first of each direction in the main leg and the rest, in order, into
// the connecting-leg arrays.
const flight = (type: string, from: string, to: string, dep: string, arr: string, no = "") => ({
  flight_number: no,
  flight_type: type,
  departing_airport: from,
  departing_airport_name: "",
  departure_date_time: dep,
  arrival_airport: to,
  arrival_airport_name: "",
  arrival_date_time: arr,
});

describe("mapScraperJsonToFormFields — multi-leg flights", () => {
  it("maps 3 scraped legs (outbound connection + return) in order", () => {
    const data = {
      flights: [
        flight("outbound", "MAN", "AMS", "2027-05-12T06:00", "2027-05-12T08:00", "KL1"),
        flight("outbound", "AMS", "MBJ", "2027-05-12T09:30", "2027-05-12T12:45", "KL2"),
        flight("return", "MBJ", "MAN", "2027-05-26T16:50", "2027-05-27T07:40", "BY3"),
      ],
    } as unknown as ScraperJson;
    const out = mapScraperJsonToFormFields(data);
    expect(out.outboundConnectingLegs).toHaveLength(1);
    expect(out.outboundConnectingLegs[0]).toMatchObject({ departAirport: "AMS", arriveAirport: "MBJ", flightNumber: "KL2", departTime: "09:30" });
    expect(out.inboundConnectingLegs).toEqual([]);
    expect(out.fields.outboundFlightNumber).toBe("KL1");
    expect(out.fields.inboundFlightNumber).toBe("BY3");
  });

  it("keeps the plain 2-leg behaviour", () => {
    const data = {
      flights: [flight("outbound", "MAN", "MBJ", "2027-05-12T11:10", "2027-05-12T14:50"), flight("return", "MBJ", "MAN", "2027-05-26T16:50", "2027-05-27T07:40")],
    } as unknown as ScraperJson;
    const out = mapScraperJsonToFormFields(data);
    expect(out.outboundConnectingLegs).toEqual([]);
    expect(out.inboundConnectingLegs).toEqual([]);
    expect(out.fields.outboundDepartAirport).toBe("MAN");
    expect(out.fields.inboundDepartAirport).toBe("MBJ");
  });
});

describe("mapScraperJsonToFormFields — check-in rule for every import", () => {
  const trip = (outbound: Array<ReturnType<typeof flight>>, extra: Record<string, unknown> = {}) =>
    ({ travel_date: "2027-05-12", flights: outbound, ...extra }) as unknown as ScraperJson;

  it("uses 15:00 when the outbound lands before 15:00 (departure time is ignored)", () => {
    const out = mapScraperJsonToFormFields(trip([flight("outbound", "MAN", "MBJ", "2027-05-12T06:00", "2027-05-12T14:50")]));
    expect(out.fields.checkInDate).toBe("2027-05-12");
    expect(out.fields.checkInTime).toBe("15:00");
  });

  it("uses landing +1h when the outbound lands after 15:00", () => {
    const out = mapScraperJsonToFormFields(trip([flight("outbound", "MAN", "MBJ", "2027-05-12T09:00", "2027-05-12T17:30")]));
    expect(out.fields.checkInDate).toBe("2027-05-12");
    expect(out.fields.checkInTime).toBe("18:30");
  });

  it("uses the last outbound leg and rolls past midnight into the next day", () => {
    const out = mapScraperJsonToFormFields(
      trip([
        flight("outbound", "MAN", "AMS", "2027-05-12T06:00", "2027-05-12T08:00", "KL1"),
        flight("outbound", "AMS", "MBJ", "2027-05-12T20:00", "2027-05-12T23:30", "KL2"),
      ]),
    );
    expect(out.fields.checkInDate).toBe("2027-05-13");
    expect(out.fields.checkInTime).toBe("00:30");
  });

  it("keeps the default 15:00 when the outbound arrival time is missing", () => {
    const out = mapScraperJsonToFormFields(trip([flight("outbound", "MAN", "MBJ", "2027-05-12T06:00", "")]));
    expect(out.fields.checkInTime).toBe("15:00");
    expect(out.fields.checkInDate).toBe("2027-05-12");
  });

  it("applies the rule over an explicit hotel check-in time from the supplier", () => {
    const out = mapScraperJsonToFormFields(
      trip([flight("outbound", "MAN", "MBJ", "2027-05-12T06:00", "2027-05-12T10:00")], {
        hotels: [{ check_in_date_time: "2027-05-12T12:00" }],
      }),
    );
    expect(out.fields.checkInTime).toBe("15:00");
  });
});
