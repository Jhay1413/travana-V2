import { describe, it, expect } from "vitest";
import { sanitisePin } from "./PinField";
import { stripPrefix } from "./PortalFooter";
import { portalButtonClass } from "./brand";
import { menuCount } from "./PortalMenu";
import { flightItems, otherItems } from "./bookings/BookingFlights";
import type { JourneyItem } from "../lib/quote-journey";

describe("sanitisePin", () => {
  it("keeps digits only and at most four", () => {
    expect(sanitisePin("12a3-4567")).toBe("1234");
    expect(sanitisePin("abc")).toBe("");
  });
});

describe("stripPrefix", () => {
  it("does not repeat a prefix the agency typed", () => {
    expect(stripPrefix("ATOL 1234", "ATOL")).toBe("1234");
    expect(stripPrefix("atol1234", "ATOL")).toBe("1234");
    expect(stripPrefix("1234", "ATOL")).toBe("1234");
    expect(stripPrefix("ATOL", "ATOL")).toBe("ATOL");
  });
});

describe("portalButtonClass", () => {
  it("is square and keeps a 44px+ target", () => {
    const cls = portalButtonClass("amber");
    expect(cls).toContain("rounded-none");
    expect(cls).toContain("min-h-[52px]");
  });

  it("matches the reference base: uppercase, 12px, 0.28em tracking, 16px icons", () => {
    const cls = portalButtonClass("outline");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("text-xs");
    expect(cls).toContain("tracking-[0.28em]");
    expect(cls).toContain("[&_svg]:size-4");
  });

  it("has the design's sizes: default 52px / 0 30px, sm 52px / 0 8px / 11px / 0.18em, xs 48px, lg 56px", () => {
    expect(portalButtonClass("amber", undefined, "default")).toContain("min-h-[52px]");
    expect(portalButtonClass("amber", undefined, "default")).toContain("px-[30px]");
    const sm = portalButtonClass("outline", undefined, "sm");
    expect(sm).toContain("min-h-[52px]");
    expect(sm).toContain("px-2");
    expect(sm).toContain("text-[11px]");
    expect(sm).toContain("tracking-[0.18em]");
    const xs = portalButtonClass("outline", undefined, "xs");
    expect(xs).toContain("min-h-12");
    expect(xs).toContain("px-2");
    expect(portalButtonClass("amber", undefined, "lg")).toContain("min-h-14");
  });

  it("has the design's amber hover colour", () => {
    expect(portalButtonClass("amber")).toContain("hover:bg-[#E8873A]");
  });

  it("has the reference weights: amber medium, everything else normal", () => {
    expect(portalButtonClass("amber")).toContain("font-medium");
    for (const v of ["outline", "light", "navy", "link"] as const) {
      expect(portalButtonClass(v)).toContain("font-normal");
      expect(portalButtonClass(v)).not.toContain("font-medium");
    }
  });

  it("the link variant is text only: 44px high, no horizontal padding, whatever the size", () => {
    const cls = portalButtonClass("link", undefined, "sm");
    expect(cls).toContain("min-h-11");
    expect(cls).toContain("px-0");
    expect(cls).not.toContain("px-2");
  });

  it("lets labels wrap instead of clipping", () => {
    expect(portalButtonClass("outline")).not.toContain("whitespace-nowrap");
  });
});

describe("sanitisePin on paste", () => {
  it("strips non-digits before cutting to four", () => {
    expect(sanitisePin("12ab34567")).toBe("1234");
    expect(sanitisePin(" 4 8 2 1 9")).toBe("4821");
  });
});

describe("menuCount", () => {
  it("says nothing when there is nothing to count", () => {
    expect(menuCount(undefined, "to view")).toBeUndefined();
    expect(menuCount(0, "booked")).toBeUndefined();
  });
  it("puts the number before the words", () => {
    expect(menuCount(3, "to view")).toBe("3 to view");
    expect(menuCount(1, "booked")).toBe("1 booked");
  });
});

describe("booking flights split", () => {
  const item = (key: string, kind: JourneyItem["kind"], withFlight: boolean): JourneyItem => ({
    key,
    kind,
    kicker: key,
    title: key,
    detail: [],
    sortKey: key,
    ...(withFlight ? { flight: { from: "A", to: "B", dep: "10:00", arr: "12:00", nextDay: false } } : {}),
  });
  const journey = [item("out", "flight-out", true), item("t", "transfer", false), item("h", "hotel", false), item("back", "flight-in", true), item("x", "extra", false)];

  it("takes the flight legs for the design's flights cards and keeps everything else for the numbered list", () => {
    expect(flightItems(journey).map((i) => i.key)).toEqual(["out", "back"]);
    expect(otherItems(journey).map((i) => i.key)).toEqual(["t", "h", "x"]);
  });

  it("loses nothing: every journey item lands in exactly one of the two", () => {
    expect(flightItems(journey).length + otherItems(journey).length).toBe(journey.length);
  });
});

describe("design chrome", () => {
  it("the sheet has the design's overlay, handle and entrance", async () => {
    const src = String((await import("./PortalSheet?raw")).default);
    expect(src).toContain("rgba(0,26,58,0.62)");
    expect(src).toContain("portal-sheet-in");
    expect(src).toContain("h-[3px] w-10 bg-[#D9C7B1]");
  });

  it("the tab bar draws the four design tabs with the design's idle opacity", async () => {
    const src = String((await import("./PortalTabBar?raw")).default);
    expect(src).toContain("text-white/[0.62]");
    expect(src).toContain("M3 10.5L12 3l9 7.5");
  });
});

describe("hero", () => {
  it("is 640px (600 from md) tall by default, with the reference's plain fallback colour", async () => {
    const src = await import("./brand?raw");
    expect(String(src.default)).toContain("h-[640px]");
    expect(String(src.default)).toContain("md:h-[600px]");
    expect(String(src.default)).toContain("bg-[#0D2A4E]");
  });
});
