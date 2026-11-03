import { describe, expect, it } from "vitest";
import type { ProfitSourceRow } from "../types";
import { barWidth, maxOf, share, sortSources, sourceTile } from "./sources-math";

const rows: ProfitSourceRow[] = [
  { source: "FACEBOOK", label: "Facebook", profit: 800, bookings: 4 },
  { source: "SHOP", label: "Shop", profit: 1200, bookings: 3 },
  { source: "none", label: "Not recorded", profit: 800, bookings: 6 },
];

describe("sources-math", () => {
  it("maps tiles", () => {
    expect(sourceTile("SHOP")).toBe("SH");
    expect(sourceTile("PHONE_ENQUIRY")).toBe("PH");
    expect(sourceTile("none")).toBe("–");
    expect(sourceTile("TIKTOK")).toBe("TI");
  });

  it("sorts by profit then bookings", () => {
    expect(sortSources(rows, "profit").map((r) => r.label)).toEqual(["Shop", "Not recorded", "Facebook"]);
  });

  it("sorts by bookings then profit", () => {
    expect(sortSources(rows, "bookings").map((r) => r.label)).toEqual(["Not recorded", "Facebook", "Shop"]);
  });

  it("computes share and bar width", () => {
    expect(share(1200, 2800)).toBe(43);
    expect(share(5, 0)).toBe(0);
    expect(barWidth(600, 1200)).toBe(50);
    expect(barWidth(5, 0)).toBe(0);
    expect(maxOf(rows, "profit")).toBe(1200);
  });
});
