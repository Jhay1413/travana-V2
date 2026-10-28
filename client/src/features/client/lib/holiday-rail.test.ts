import { describe, expect, it } from "vitest";
import type { Quote } from "@/features/quote/types";
import type { DealRowGroups, HolidayRowData } from "./live-deal-rows";
import { airportCode, defaultRailTab, quoteRailMeta, railCounts, railPills } from "./holiday-rail";

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

describe("defaultRailTab", () => {
  it("follows the selected deal type", () => {
    expect(defaultRailTab({ type: "enquiry", id: "1" })).toBe("enquiry");
    expect(defaultRailTab({ type: "booking", id: "1" })).toBe("bookings");
    expect(defaultRailTab({ type: "quote", id: "1" })).toBe("quotes");
  });
  it("falls back to quotes with no selection", () => {
    expect(defaultRailTab(null)).toBe("quotes");
  });
});

describe("railCounts", () => {
  it("counts active quotes with their copies and ignores expired and lost", () => {
    const groups: DealRowGroups = {
      active: [row({ id: "a", copies: [row({ id: "c1" }), row({ id: "c2" })] }), row({ id: "b" })],
      expired: [row({ id: "e" })],
      lost: [row({ id: "l" })],
    };
    expect(railCounts([row({ type: "enquiry" })], groups, [row({ type: "booking" }), row({ type: "booking" })])).toEqual({
      enquiry: 1,
      quotes: 4,
      bookings: 2,
    });
  });
});

describe("airportCode", () => {
  it("extracts the bracketed code", () => {
    expect(airportCode("London Gatwick (LGW)")).toBe("LGW");
  });
  it("returns null when there is none", () => {
    expect(airportCode("Gatwick")).toBeNull();
    expect(airportCode(null)).toBeNull();
  });
});

describe("railPills", () => {
  it("returns nothing for a plain row", () => {
    expect(railPills(row({}), { pinned: false })).toEqual([]);
  });
  it("orders Copy, Pinned, Viewed, Expires", () => {
    const pills = railPills(row({ isCopy: true }), { pinned: true, viewCount: 3, expiresInDays: 5 });
    expect(pills.map((p) => p.label)).toEqual(["Copy", "Pinned", "Viewed 3×", "Expires in 5d"]);
    expect(pills[3]?.tone).toBe("warn");
  });
  it("shows no expiry pill when expiry is more than 7 days away", () => {
    expect(railPills(row({}), { pinned: false, expiresInDays: 12 })).toEqual([]);
    expect(railPills(row({}), { pinned: false, expiresInDays: 7 })).toEqual([{ tone: "warn", label: "Expires in 7d" }]);
  });
  it("hides views and expiry on expired, lost, booking and enquiry rows", () => {
    const state = { pinned: false, viewCount: 2, expiresInDays: 3 };
    expect(railPills(row({ expired: true }), state)).toEqual([]);
    expect(railPills(row({ lost: true }), state)).toEqual([]);
    expect(railPills(row({ type: "booking" }), state)).toEqual([]);
    expect(railPills(row({ type: "enquiry" }), state)).toEqual([]);
  });
  it("skips Viewed when the count is zero", () => {
    expect(railPills(row({}), { pinned: false, viewCount: 0 })).toEqual([]);
  });
  it("says 'Expires today' at zero days", () => {
    expect(railPills(row({}), { pinned: false, expiresInDays: 0 })[0]?.label).toBe("Expires today");
  });
});

describe("quoteRailMeta", () => {
  const now = new Date("2026-10-21T10:00:00Z");
  function q(id: string, date_expiry: string | null): Quote {
    return { id, date_expiry, date_created: "2026-10-01T00:00:00Z" } as unknown as Quote;
  }
  it("gives days left for a quote with an explicit expiry", () => {
    const meta = quoteRailMeta([q("a", "2026-10-24T10:00:00Z")], now);
    expect(meta.get("a")).toEqual({ expiresInDays: 3 });
  });
  it("gives null when expired or without a date", () => {
    const meta = quoteRailMeta([q("a", "2026-10-01T10:00:00Z"), q("b", null)], now);
    expect(meta.get("a")).toEqual({ expiresInDays: null });
    expect(meta.get("b")).toEqual({ expiresInDays: null });
  });
});
