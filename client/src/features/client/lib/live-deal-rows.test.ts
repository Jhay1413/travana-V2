import { describe, expect, it } from "vitest";
import type { EnquiryTable, Quote } from "@/features/quote/types";
import type { HolidayBooking } from "@/features/client/types";
import {
  buildBookingRows,
  buildEnquiryRows,
  buildQuoteRows,
  filterDealRows,
  groupDealRows,
  netPrice,
  sortDealRows,
  type HolidayRowData,
} from "./live-deal-rows";

const FUTURE = "2999-01-01T00:00:00.000Z";

function quote(parts: Record<string, unknown>): Quote {
  return { quote_status: "sent", date_expiry: FUTURE, transaction_id: "t", ...parts } as unknown as Quote;
}

function row(parts: Partial<HolidayRowData>): HolidayRowData {
  return {
    id: "r",
    type: "quote",
    title: "Row",
    price: 0,
    operatorName: null,
    operatorLogoUrl: null,
    destinationName: null,
    dateLine: null,
    createdAt: null,
    expired: false,
    lost: false,
    isCopy: false,
    copies: [],
    ...parts,
  };
}

describe("netPrice", () => {
  it("is sales minus discounts plus service charge, blanks as 0", () => {
    expect(netPrice("1000", "100", "25")).toBe(925);
    expect(netPrice("1000", null, undefined)).toBe(1000);
  });
});

describe("row builders", () => {
  it("drops quotes whose transaction is booked and nests copies under the primary", () => {
    const rows = buildQuoteRows(
      [
        quote({ id: "p", transaction_id: "t1", title: "Primary", sales_price: "2000", isQuoteCopy: false }),
        quote({ id: "c", transaction_id: "t1", title: "Copy", isQuoteCopy: true }),
        quote({ id: "gone", transaction_id: "t2", title: "Booked" }),
      ],
      new Set(["t2"]),
    );
    expect(rows.map((r) => r.id)).toEqual(["p"]);
    expect(rows[0].copies.map((r) => r.id)).toEqual(["c"]);
    expect(rows[0].price).toBe(2000);
  });

  it("marks lost quotes and enquiries", () => {
    expect(buildQuoteRows([quote({ id: "q", quote_status: "lost" })], new Set())[0]).toMatchObject({ lost: true, expired: true });
    const e = buildEnquiryRows([{ id: "e", status: "lost", title: "Spain" } as unknown as EnquiryTable]);
    expect(e[0]).toMatchObject({ lost: true, price: 0 });
  });

  it("only flags LOST bookings as lost when asked", () => {
    const bookings = [{ id: "b", booking_status: "LOST", sales_price: "500" } as unknown as HolidayBooking];
    expect(buildBookingRows(bookings)[0].lost).toBe(false);
    expect(buildBookingRows(bookings, { markLostBookings: true })[0].lost).toBe(true);
  });
});

describe("sortDealRows", () => {
  const rows = [
    row({ id: "a", price: 100, createdAt: "2026-01-01" }),
    row({ id: "b", price: 900, createdAt: "2026-03-01" }),
    row({ id: "c", price: 500, createdAt: "2026-02-01" }),
  ];
  const ids = (list: HolidayRowData[]) => list.map((r) => r.id);

  it("sorts by date and price", () => {
    expect(ids(sortDealRows(rows, "newest", new Set()))).toEqual(["b", "c", "a"]);
    expect(ids(sortDealRows(rows, "oldest", new Set()))).toEqual(["a", "c", "b"]);
    expect(ids(sortDealRows(rows, "highest", new Set()))).toEqual(["b", "c", "a"]);
    expect(ids(sortDealRows(rows, "lowest", new Set()))).toEqual(["a", "c", "b"]);
  });

  it("keeps pinned rows first", () => {
    expect(ids(sortDealRows(rows, "highest", new Set(["quote:a"])))).toEqual(["a", "b", "c"]);
  });
});

describe("filterDealRows", () => {
  const rows = [
    row({ id: "cheap", title: "Tenerife", price: 2999 }),
    row({ id: "edge", title: "Maldives", price: 3000, destinationName: "Male" }),
    row({ id: "parent", title: "Crete", price: 100, copies: [row({ id: "kid", title: "Rhodes", price: 4000 })] }),
  ];
  const ids = (list: HolidayRowData[]) => list.map((r) => r.id);

  it("splits the price band at 3000 inclusive", () => {
    expect(ids(filterDealRows(rows, "", "under"))).toEqual(["cheap", "parent"]);
    expect(ids(filterDealRows(rows, "", "over"))).toEqual(["edge", "parent"]);
    expect(ids(filterDealRows(rows, "", "any"))).toEqual(["cheap", "edge", "parent"]);
  });

  it("searches title and destination, keeping a group when a copy matches", () => {
    expect(ids(filterDealRows(rows, "male", "any"))).toEqual(["edge"]);
    expect(ids(filterDealRows(rows, "rhodes", "any"))).toEqual(["parent"]);
    expect(ids(filterDealRows(rows, "  TENE ", "any"))).toEqual(["cheap"]);
  });
});

describe("groupDealRows", () => {
  it("gives lost precedence over expired", () => {
    const g = groupDealRows([
      row({ id: "live" }),
      row({ id: "exp", expired: true }),
      row({ id: "lost", expired: true, lost: true }),
    ]);
    expect(g.active.map((r) => r.id)).toEqual(["live"]);
    expect(g.expired.map((r) => r.id)).toEqual(["exp"]);
    expect(g.lost.map((r) => r.id)).toEqual(["lost"]);
  });
});
