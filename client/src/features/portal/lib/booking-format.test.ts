import { describe, expect, it } from "vitest";
import type { PortalBookingListItem } from "@shared/portal-bookings";
import { PRICE_DISCLAIMER, PRICE_INCLUDES_LINE } from "./quote-format";
import { aboutBookingText, bookedLink, heroCountdown, paymentsSectionEnabled, splitBookings, tripStatusLine } from "./booking-format";
import { MAX_ABOUT, prefillFromSearch, aboutParam } from "./message-prefill";

const booking = (id: string, status: PortalBookingListItem["trip_status"], days: number, start: string): PortalBookingListItem => ({
  id, title: `Trip ${id}`, destination: "Rome, Italy", hotel: "", price: 1000, price_per_person: 500, travel_date: start, return_date: null, nights: 7,
  booking_reference: "HAY-1", image_url: "", documents_url: "#", supplier_reference: null, operator_name: null, board: null, adults: 2, children: 0,
  infants: 0, trip_status: status, days_to_go: days,
});

describe("tripStatusLine", () => {
  it("counts the days for an upcoming trip, in the singular for one", () => {
    expect(tripStatusLine("upcoming", 12)).toBe("12 days to go");
    expect(tripStatusLine("upcoming", 1)).toBe("1 day to go");
  });
  it("says so when you are away or have travelled", () => {
    expect(tripStatusLine("in_progress", -2)).toBe("You're away now");
    expect(tripStatusLine("past", -30)).toBe("Travelled");
  });
});

describe("heroCountdown", () => {
  it("is a large figure and 'Days to go' for an upcoming trip", () => {
    expect(heroCountdown("upcoming", 40)).toEqual({ figure: "40", label: "Days to go" });
    expect(heroCountdown("upcoming", 1)).toEqual({ figure: "1", label: "Day to go" });
  });
  it("has no figure once the trip has started or finished", () => {
    expect(heroCountdown("in_progress", 0)).toEqual({ figure: null, label: "You're away" });
    expect(heroCountdown("past", -9)).toEqual({ figure: null, label: "Travelled" });
  });
});

describe("splitBookings", () => {
  it("puts the trip you are on first, then the soonest, and past trips most recent first", () => {
    const { upcoming, past } = splitBookings([
      booking("far", "upcoming", 90, "2027-02-22"),
      booking("old", "past", -300, "2026-01-10"),
      booking("away", "in_progress", -2, "2026-11-22"),
      booking("soon", "upcoming", 7, "2026-12-01"),
      booking("recent", "past", -30, "2026-10-25"),
    ]);
    expect(upcoming.map((b) => b.id)).toEqual(["away", "soon", "far"]);
    expect(past.map((b) => b.id)).toEqual(["recent", "old"]);
  });
  it("copes with nothing", () => {
    expect(splitBookings([])).toEqual({ upcoming: [], past: [] });
  });
});

describe("aboutBookingText", () => {
  it("is 'title (reference)' and the composer reads 'About title (reference): '", () => {
    expect(aboutBookingText("Hotel Roma", "HAY-1234567")).toBe("Hotel Roma (HAY-1234567)");
    expect(prefillFromSearch(`?about=${aboutParam(aboutBookingText("Hotel Roma", "HAY-1234567"))}`)).toBe("About Hotel Roma (HAY-1234567): ");
  });
  it("shortens a very long title, never the reference", () => {
    const text = aboutBookingText("A".repeat(300), "HAY-1234567");
    expect(text.length).toBeLessThanOrEqual(MAX_ABOUT);
    expect(text.endsWith(" (HAY-1234567)")).toBe(true);
    expect(prefillFromSearch(`?about=${aboutParam(text)}`)).toContain("(HAY-1234567): ");
  });
  it("is just the title when there is no reference", () => {
    expect(aboutBookingText("Hotel Roma", "  ")).toBe("Hotel Roma");
  });
});

describe("paymentsSectionEnabled", () => {
  it("is off unless the flag is exactly switched on", () => {
    expect(paymentsSectionEnabled(undefined)).toBe(false);
    expect(paymentsSectionEnabled("")).toBe(false);
    expect(paymentsSectionEnabled("false")).toBe(false);
    expect(paymentsSectionEnabled("0")).toBe(false);
    expect(paymentsSectionEnabled("yes")).toBe(false);
  });
  it("is on for 'true' and '1'", () => {
    expect(paymentsSectionEnabled("true")).toBe(true);
    expect(paymentsSectionEnabled("1")).toBe(true);
  });
});

describe("bookedLink", () => {
  it("goes straight to the booking when the server named one, else to the Bookings list", () => {
    expect(bookedLink("3f2b8c1e-5d4a-4b7e-9c0d-1a2b3c4d5e6f")).toBe("/portal/booking/3f2b8c1e-5d4a-4b7e-9c0d-1a2b3c4d5e6f");
    expect(bookedLink(null)).toBe("/portal/bookings");
    expect(bookedLink(undefined)).toBe("/portal/bookings");
    expect(bookedLink("")).toBe("/portal/bookings");
  });
});

describe("price lines", () => {
  it("a booking says only what the price includes; a quote keeps the availability caveat", () => {
    expect(PRICE_INCLUDES_LINE).toBe("Prices include all applicable taxes and fees.");
    expect(PRICE_INCLUDES_LINE).not.toMatch(/availability/i);
    expect(PRICE_DISCLAIMER).toBe("Prices include all applicable taxes and fees. Subject to availability.");
  });
});
