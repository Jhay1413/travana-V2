import { describe, it, expect } from "vitest";
import type { EnrichedQuote } from "@/features/quote/types";
import { buildCopyInitialValues, splitDateTime } from "./quote-copy-values";

function quote(overrides: Record<string, unknown>): EnrichedQuote {
  return { id: "q1", ...overrides } as unknown as EnrichedQuote;
}

describe("splitDateTime", () => {
  it("splits date and HH:mm", () => {
    expect(splitDateTime("2026-05-01T09:30:00")).toEqual({ date: "2026-05-01", time: "09:30" });
  });
  it("handles date-only and empty input", () => {
    expect(splitDateTime("2026-05-01")).toEqual({ date: "2026-05-01", time: "" });
    expect(splitDateTime(null)).toEqual({ date: "", time: "" });
  });
});

describe("buildCopyInitialValues", () => {
  it("carries the supplier link, title and money across", () => {
    const v = buildCopyInitialValues(
      quote({ title: "Majorca", quote_ref: "https://x.test/a", sales_price: "1200.50", discounts: null }),
    );
    expect(v.quoteTitle).toBe("Majorca");
    expect(v.quoteLink).toBe("https://x.test/a");
    expect(v.price).toBe(1200.5);
    expect(v.discount).toBe(0);
    expect(v.nights).toBe(7);
    expect(v.passengersAdults).toBe(2);
  });
  it("orders legs and puts extra legs in connecting legs", () => {
    const v = buildCopyInitialValues(
      quote({
        flights: [
          { flight_type: "outbound", leg_order: 2, flight_number: "B2", departure_date_time: "2026-05-01T12:00" },
          { flight_type: "outbound", leg_order: 1, flight_number: "A1", departure_date_time: "2026-05-01T08:00" },
          { flight_type: "inbound", leg_order: 1, flight_number: "C3" },
        ],
      }),
    );
    expect(v.outboundFlightNumber).toBe("A1");
    expect(v.outboundConnectingLegs?.map((l) => l.flightNumber)).toEqual(["B2"]);
    expect(v.inboundFlightNumber).toBe("C3");
    expect(v.inboundConnectingLegs).toEqual([]);
  });
  it("uses the primary accommodation", () => {
    const v = buildCopyInitialValues(
      quote({
        accommodations: [
          { is_primary: false, accomodation_id: "h1" },
          { is_primary: true, accomodation_id: "h2", check_in_date_time: "2026-05-02T15:00" },
        ],
      }),
    );
    expect(v.accommodationId).toBe("h2");
    expect(v.checkInTime).toBe("15:00");
  });
});
