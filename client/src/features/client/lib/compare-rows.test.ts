import { describe, expect, it } from "vitest";
import type { Quote } from "@/features/quote/types";
import { cheapestIndex, compareDates, compareOutbound, compareViews, pickCompareQuotes } from "./compare-rows";

const FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

function quote(id: string, parts: Record<string, unknown> = {}): Quote {
  return {
    id,
    transaction_id: `t-${id}`,
    quote_status: "sent",
    date_expiry: FUTURE,
    date_created: "2026-10-01T00:00:00.000Z",
    ...parts,
  } as unknown as Quote;
}

describe("pickCompareQuotes", () => {
  it("returns the two newest other live quotes", () => {
    const quotes = [
      quote("a", { date_created: "2026-10-01T00:00:00.000Z" }),
      quote("b", { date_created: "2026-10-05T00:00:00.000Z" }),
      quote("c", { date_created: "2026-10-03T00:00:00.000Z" }),
      quote("d", { date_created: "2026-10-04T00:00:00.000Z" }),
    ];
    expect(pickCompareQuotes("a", quotes, new Set()).map((q) => q.id)).toEqual(["b", "d"]);
  });

  it("skips the current, expired, lost and booked quotes", () => {
    const quotes = [
      quote("cur"),
      quote("expired", { date_expiry: PAST }),
      quote("lost", { quote_status: "lost" }),
      quote("booked"),
      quote("ok"),
    ];
    expect(pickCompareQuotes("cur", quotes, new Set(["t-booked"])).map((q) => q.id)).toEqual(["ok"]);
  });

  it("is empty when there is nothing else", () => {
    expect(pickCompareQuotes("a", [quote("a")], new Set())).toEqual([]);
  });
});

describe("cheapestIndex", () => {
  it("finds the lowest price per person", () => {
    expect(cheapestIndex([{ pricePerPerson: 900 }, { pricePerPerson: 750 }, { pricePerPerson: 820 }])).toBe(1);
  });
  it("ignores zero and negative prices", () => {
    expect(cheapestIndex([{ pricePerPerson: 0 }, { pricePerPerson: 500 }, { pricePerPerson: -1 }])).toBe(1);
    expect(cheapestIndex([{ pricePerPerson: 0 }, { pricePerPerson: 0 }])).toBeNull();
  });
  it("gives ties to the first column", () => {
    expect(cheapestIndex([{ pricePerPerson: 600 }, { pricePerPerson: 600 }])).toBe(0);
  });
  it("handles no columns", () => {
    expect(cheapestIndex([])).toBeNull();
  });
});

describe("row text", () => {
  it("formats dates and nights", () => {
    expect(compareDates({ travelDate: "2026-11-02", nights: 7 })).toBe("02/11/2026 · 7 nights");
    expect(compareDates({ travelDate: "2026-11-02", nights: 1 })).toBe("02/11/2026 · 1 night");
    expect(compareDates({ travelDate: "", nights: 0 })).toBe("Not set");
  });
  it("describes the outbound airport", () => {
    const flights = (from: string) => ({ outbound: { from } }) as unknown as Parameters<typeof compareOutbound>[0]["flights"];
    expect(compareOutbound({ flights: flights("Gatwick") })).toBe("depart from Gatwick");
    expect(compareOutbound({ flights: flights("") })).toBe("Not set");
  });
  it("describes the client's views", () => {
    const now = new Date("2026-10-21T12:00:00Z");
    expect(compareViews(undefined, now)).toBe("Not opened");
    expect(compareViews({ viewCount: 0, lastViewedAt: null }, now)).toBe("Not opened");
    expect(compareViews({ viewCount: 3, lastViewedAt: "2026-10-19T12:00:00Z" }, now)).toBe("3 views, last 2 days ago");
    expect(compareViews({ viewCount: 2, lastViewedAt: null }, now)).toBe("2 views");
    expect(compareViews({ viewCount: 1, lastViewedAt: "2026-10-21T09:00:00Z" }, now)).toBe("1 view, last 3 hours ago");
  });
});
