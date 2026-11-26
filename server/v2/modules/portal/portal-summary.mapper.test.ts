import { describe, it, expect } from "vitest";
import { NO_DECISION, type PortalQuoteListItem } from "@shared/portal-quotes";
import {
  buildNextBooking,
  dayNumber,
  pickNextBooking,
  pickPriceHeld,
  toIsoDay,
  ukDay,
  undecidedQuotes,
  unfinishedBookings,
} from "./portal-summary.mapper";
import type { PortalBookingDto } from "./portal.types";

const booking = (id: string, start: string, end: string | null, over: Partial<PortalBookingDto> = {}): PortalBookingDto => ({
  id, title: `Trip ${id}`, destination: "Majorca, Spain", hotel: "Hotel", price: 1000, price_per_person: 500,
  travel_date: start, return_date: end, nights: end ? 7 : null, booking_reference: "REF", image_url: "", documents_url: "#", supplier_reference: null, operator_name: null, board: null, adults: 2, children: 0, infants: 0, trip_status: "upcoming", days_to_go: 0, ...over,
});

const quote = (id: string, over: Partial<PortalQuoteListItem> = {}): PortalQuoteListItem => ({
  id, token: `TOK${id}`, title: `Quote ${id}`, destination: "Rome, Italy", hotel: "", operator_name: null, price: 1500,
  price_per_person: 750, travel_date: "2027-01-01", return_date: "2027-01-08", nights: 7, board: null, adults: 2, children: 0,
  infants: 0, expiry_date: null, sent_at: null, image_url: "", photo_count: 0, quote_url: `/portal/quote/TOK${id}`,
  decision: { ...NO_DECISION }, ...over,
});

describe("UK calendar days", () => {
  it("reads the UK day across the autumn change (GMT)", () => {
    expect(ukDay(new Date("2026-10-25T23:30:00Z"))).toBe("2026-10-25");
    expect(ukDay(new Date("2026-10-26T00:00:00Z"))).toBe("2026-10-26");
  });

  it("reads the UK day across the spring change and in summer (BST): 23:30 UTC is already the next UK day", () => {
    expect(ukDay(new Date("2026-03-28T23:30:00Z"))).toBe("2026-03-28");
    expect(ukDay(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29");
    expect(ukDay(new Date("2026-06-30T22:59:00Z"))).toBe("2026-06-30");
    expect(ukDay(new Date("2026-06-30T23:00:00Z"))).toBe("2026-07-01");
  });

  it("counts whole days between calendar days over a clock change", () => {
    expect(dayNumber("2026-03-30") - dayNumber("2026-03-28")).toBe(2);
    expect(dayNumber("2026-11-01") - dayNumber("2026-10-24")).toBe(8);
  });

  it("toIsoDay takes a string or a midnight-UTC Date", () => {
    expect(toIsoDay("2027-06-14")).toBe("2027-06-14");
    expect(toIsoDay(new Date("2027-06-14T00:00:00Z"))).toBe("2027-06-14");
  });
});

describe("next booking", () => {
  const now = new Date("2026-06-30T23:30:00Z"); // 00:30 on 1 July in the UK

  it("days to go use the UK day, not the UTC day", () => {
    const [t] = unfinishedBookings([booking("a", "2026-07-11", "2026-07-18")], now);
    expect(t.daysToGo).toBe(10);
  });

  it("is zero on the day of departure and the booking still counts as next", () => {
    const timings = unfinishedBookings([booking("a", "2026-07-01", "2026-07-08")], now);
    expect(timings[0].daysToGo).toBe(0);
    expect(pickNextBooking(timings)?.booking.id).toBe("a");
  });

  it("picks the soonest of several, whatever the order they arrive in", () => {
    const timings = unfinishedBookings(
      [booking("late", "2027-03-01", "2027-03-08"), booking("soon", "2026-08-01", "2026-08-08"), booking("mid", "2026-12-01", "2026-12-08")],
      now,
    );
    expect(pickNextBooking(timings)?.booking.id).toBe("soon");
    expect(timings).toHaveLength(3);
  });

  it("leaves out holidays that have ended, and counts the one that ended yesterday as ended", () => {
    const timings = unfinishedBookings([booking("old", "2026-05-01", "2026-05-08"), booking("yesterday", "2026-06-20", "2026-06-30")], now);
    expect(timings).toEqual([]);
    expect(pickNextBooking(timings)).toBeNull();
  });

  it("a holiday under way counts as booked but is not the 'next' one", () => {
    const timings = unfinishedBookings([booking("now", "2026-06-28", "2026-07-05"), booking("later", "2026-09-01", "2026-09-08")], now);
    expect(timings).toHaveLength(2);
    expect(pickNextBooking(timings)?.booking.id).toBe("later");
    expect(pickNextBooking(unfinishedBookings([booking("now", "2026-06-28", "2026-07-05")], now))).toBeNull();
  });

  it("a booking with no recorded length is a one-day trip: next until its day, gone the day after, no nights or end date shown", () => {
    const trip = booking("day", "2026-07-01", null);
    const [t] = unfinishedBookings([trip], now); // 1 July in the UK
    expect(t.daysToGo).toBe(0);
    expect(buildNextBooking(t, { board: null, adults: 1, children: 0, infants: 0 })).toMatchObject({ endDate: null, nights: null, daysToGo: 0 });
    expect(unfinishedBookings([trip], new Date("2026-07-01T23:30:00Z"))).toEqual([]); // 2 July 00:30 BST: finished
  });

  it("builds the allowlisted summary: nights from the dates, no price or reference leaks", () => {
    const [t] = unfinishedBookings([booking("a", "2026-07-11", "2026-07-18", { image_url: "/p.jpg" })], now);
    const next = buildNextBooking(t, { board: "All Inclusive", adults: 2, children: 1, infants: 0 });
    expect(next).toEqual({
      id: "a", title: "Trip a", destination: "Majorca, Spain", startDate: "2026-07-11", endDate: "2026-07-18", nights: 7,
      board: "All Inclusive", adults: 2, children: 1, infants: 0, imageUrl: "/p.jpg", daysToGo: 10,
    });
    expect(Object.keys(next).join(" ")).not.toMatch(/price|cost|commission|reference|hotel/i);
  });
});

describe("price held", () => {
  const now = new Date("2026-11-24T10:00:00Z");
  const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();

  it("picks the undecided quote that expires soonest", () => {
    const held = pickPriceHeld([quote("1", { expiry_date: inDays(20) }), quote("2", { expiry_date: inDays(3), price: 2400 }), quote("3", { expiry_date: inDays(9) })], now);
    expect(held).toMatchObject({ token: "TOK2", title: "Quote 2", total: 2400, daysLeft: 3 });
  });

  it("ignores decided quotes (interested or declined), expired ones, ones with no expiry and unreadable ones", () => {
    const held = pickPriceHeld(
      [
        quote("interested", { expiry_date: inDays(1), decision: { ...NO_DECISION, state: "interested" } }),
        quote("declined", { expiry_date: inDays(1), decision: { ...NO_DECISION, state: "declined" } }),
        quote("expired", { expiry_date: inDays(-1) }),
        quote("none", { expiry_date: null }),
        quote("junk", { expiry_date: "not a date" }),
        quote("ok", { expiry_date: inDays(30) }),
      ],
      now,
    );
    expect(held?.token).toBe("TOKok");
  });

  it("is null when nothing qualifies", () => {
    expect(pickPriceHeld([], now)).toBeNull();
    expect(pickPriceHeld([quote("1"), quote("2", { expiry_date: inDays(-2) })], now)).toBeNull();
  });

  it("an expiry later today is still held, with 0 days left; one a moment ago is not", () => {
    expect(pickPriceHeld([quote("1", { expiry_date: "2026-11-24T23:59:00.000Z" })], now)?.daysLeft).toBe(0);
    expect(pickPriceHeld([quote("1", { expiry_date: "2026-11-24T09:59:59.000Z" })], now)).toBeNull();
  });

  it("counts days left in UK days: 23:30 UTC in summer is already tomorrow", () => {
    const summer = new Date("2026-06-30T10:00:00Z");
    const held = pickPriceHeld([quote("1", { expiry_date: "2026-07-02T23:30:00.000Z" })], summer);
    expect(held?.daysLeft).toBe(3); // 3 July UK
  });

  it("prints the UK calendar day of the expiry: 23:30 UTC in summer is 00:30 BST the next day", () => {
    const summer = new Date("2026-06-20T10:00:00Z");
    const held = pickPriceHeld([quote("1", { expiry_date: "2026-06-30T23:30:00.000Z" })], summer);
    expect(held?.expiresOn).toBe("2026-07-01");
    expect(held?.daysLeft).toBe(11); // the same UK day the date shows
    // In winter the UK day is the UTC day.
    expect(pickPriceHeld([quote("1", { expiry_date: "2026-12-30T23:30:00.000Z" })], new Date("2026-12-20T10:00:00Z"))?.expiresOn).toBe("2026-12-30");
  });

  it("returns only the allowlisted keys", () => {
    const held = pickPriceHeld([quote("1", { expiry_date: inDays(2) })], now);
    expect(Object.keys(held ?? {}).sort()).toEqual(["daysLeft", "expiresAt", "expiresOn", "title", "token", "total"]);
  });
});

describe("quotes awaiting a decision", () => {
  it("counts only the unanswered ones", () => {
    expect(
      undecidedQuotes([
        quote("1"),
        quote("2", { decision: { ...NO_DECISION, state: "interested" } }),
        quote("3", { decision: { ...NO_DECISION, state: "declined" } }),
        quote("4"),
      ]).map((q) => q.id),
    ).toEqual(["1", "4"]);
  });
});
