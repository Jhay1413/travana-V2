import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import {
  clientMoneyStats,
  dealMetaLine,
  quoteDateLine,
  selectExpiredDeals,
  selectLiveDeals,
  selectLiveQuotes,
  type LiveQuoteRecord,
} from "./deals";

const FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

function txn(parts: { quotes?: Record<string, unknown>[]; enquiry?: Record<string, unknown> | null; booking?: Record<string, unknown> | null }): Transaction {
  return { quotes: parts.quotes ?? [], enquiry: parts.enquiry ?? null, booking: parts.booking ?? null } as unknown as Transaction;
}

describe("selectLiveQuotes", () => {
  it("returns an empty list for no transactions", () => {
    expect(selectLiveQuotes(undefined)).toEqual([]);
  });

  it("keeps live quotes, drops lost/won/expired, newest first", () => {
    const result = selectLiveQuotes([
      txn({
        quotes: [
          { id: "old", quote_status: "sent", date_expiry: FUTURE, date_created: "2026-01-01" },
          { id: "new", quote_status: "sent", date_expiry: FUTURE, date_created: "2026-03-01" },
          { id: "lost", quote_status: "lost", date_expiry: FUTURE, date_created: "2026-04-01" },
          { id: "won", quote_status: "won", date_expiry: FUTURE, date_created: "2026-04-02" },
          { id: "expired", quote_status: "sent", date_expiry: PAST, date_created: "2026-04-03" },
        ],
      }),
    ]);
    expect(result.map((q) => q.id)).toEqual(["new", "old"]);
  });
});

describe("selectExpiredDeals", () => {
  it("includes expired quotes and enquiries but not won quotes", () => {
    const result = selectExpiredDeals([
      txn({
        quotes: [
          { id: "q1", quote_status: "sent", date_expiry: PAST, date_created: "2026-01-01", title: "Maldives", sales_price: "1200" },
          { id: "won", quote_status: "won", date_expiry: PAST, date_created: "2026-01-02" },
          { id: "live", quote_status: "sent", date_expiry: FUTURE, date_created: "2026-01-03" },
        ],
        enquiry: { id: "e1", status: "expired", date_created: "2026-02-01", title: "Spain" },
      }),
    ]);
    expect(result.map((r) => r.id)).toEqual(["e1", "q1"]);
    expect(result.find((r) => r.id === "q1")).toMatchObject({ kind: "quote", price: 1200, title: "Maldives" });
    expect(result.find((r) => r.id === "e1")).toMatchObject({ kind: "enquiry", price: 0 });
  });
});

describe("dealMetaLine", () => {
  it("joins the present parts with a middle dot", () => {
    expect(dealMetaLine({ destinationName: "Maldives", dateLine: "LGW - 01/05/2026", operatorName: "TUI" })).toBe(
      "Maldives · LGW - 01/05/2026 · TUI",
    );
  });

  it("skips empty parts", () => {
    expect(dealMetaLine({ destinationName: null, dateLine: "", operatorName: "TUI" })).toBe("TUI");
    expect(dealMetaLine({})).toBe("");
  });
});

describe("quoteDateLine", () => {
  it("combines airport code with the travel date range", () => {
    const q = { departing_airport_code: "LGW", travel_date: "2026-05-01T12:00:00.000Z", num_of_nights: 7 } as unknown as LiveQuoteRecord;
    expect(quoteDateLine(q)).toBe("LGW - 01/05/2026 → 08/05/2026");
  });

  it("returns null when nothing is known", () => {
    expect(quoteDateLine({} as unknown as LiveQuoteRecord)).toBeNull();
  });
});

describe("clientMoneyStats", () => {
  it("sums commission as profit and total_price (else sales_price) as spend", () => {
    const stats = clientMoneyStats([
      txn({ booking: { package_commission: "100.50", total_price: "1000", sales_price: "900" } }),
      txn({ booking: { package_commission: "50", sales_price: "500" } }),
      txn({}),
    ]);
    expect(stats).toEqual({ bookings: 2, profit: 150.5, spend: 1500 });
  });

  it("excludes LOST bookings from bookings, profit and spend", () => {
    const stats = clientMoneyStats([
      txn({ booking: { package_commission: "100", sales_price: "1000", booking_status: "BOOKED" } }),
      txn({ booking: { package_commission: "75", sales_price: "800", booking_status: "LOST" } }),
      txn({ booking: { package_commission: "25", sales_price: "200", booking_status: "lost" } }),
    ]);
    expect(stats).toEqual({ bookings: 1, profit: 100, spend: 1000 });
  });

  it("treats missing or invalid numbers as 0", () => {
    expect(clientMoneyStats([txn({ booking: { package_commission: null, sales_price: "abc" } })])).toEqual({
      bookings: 1,
      profit: 0,
      spend: 0,
    });
    expect(clientMoneyStats(undefined)).toEqual({ bookings: 0, profit: 0, spend: 0 });
  });
});

describe("selectLiveDeals", () => {
  const now = new Date("2026-07-01T12:00:00Z");

  const booking = { id: "b1", title: "Tenerife", sales_price: "3180", travel_date: "2026-08-02", num_of_nights: 7, date_created: "2026-05-01" };
  const quote = {
    id: "q1", title: "Lanzarote", sales_price: "3480", quote_status: "sent", date_expiry: FUTURE, date_created: "2026-06-01",
    travel_date: "2026-02-13", num_of_nights: 7, destination_name: "Lanzarote",
  };
  const lostQuote = { id: "lost", quote_status: "lost", date_expiry: FUTURE, date_created: "2026-06-02" };
  const enquiry = { id: "e1", title: "Spain", status: "new", date_created: "2026-06-15" };

  it("orders newest first and builds meta lines", () => {
    const rows = selectLiveDeals(
      [txn({ booking }), txn({ quotes: [quote, lostQuote] }), txn({ enquiry })],
      now,
    );
    expect(rows.map((r) => r.id)).toEqual(["e1", "q1", "b1"]);
    expect(rows[0]).toMatchObject({ kind: "enquiry", letter: "E", status: "Enquiry", meta: "Dates not set" });
    expect(rows[1]).toMatchObject({ kind: "quote", letter: "Q", status: "Quoted", meta: "Lanzarote · 13 Feb to 20 Feb", price: 3480 });
    expect(rows[2]).toMatchObject({ kind: "booking", letter: "B", status: "Booked", meta: "flies 2 Aug · 7 nights", price: 3180 });
  });

  it("shows one row per deal at its current stage", () => {
    const booked = selectLiveDeals([txn({ booking, quotes: [quote], enquiry })], now);
    expect(booked.map((r) => r.kind)).toEqual(["booking"]);
    const quoted = selectLiveDeals([txn({ quotes: [quote, lostQuote], enquiry })], now);
    expect(quoted.map((r) => r.kind)).toEqual(["quote"]);
    const lostOnly = selectLiveDeals([txn({ quotes: [lostQuote], enquiry })], now);
    expect(lostOnly.map((r) => r.kind)).toEqual(["enquiry"]);
  });

  it("uses flew for past travel dates", () => {
    const rows = selectLiveDeals(
      [txn({ booking: { id: "b", travel_date: "2026-06-01", num_of_nights: 1, date_created: "2026-01-01" } })],
      now,
    );
    expect(rows[0].meta).toBe("flew 1 Jun · 1 night");
  });
});
