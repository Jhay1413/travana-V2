import { describe, it, expect } from "vitest";
import type { PortalBookingListItem } from "@shared/portal-bookings";
import type { PortalQuoteListItem } from "@shared/portal-quotes";
import {
  EMPTY_DRAFT,
  EMPTY_MESSAGE_ERROR,
  MAX_MESSAGE_TEXT,
  aboutFromPath,
  agentInitials,
  buildAboutOptions,
  composeMessage,
  defaultAboutKey,
  replyLine,
  resolveAbout,
  sentStamp,
  validateDraft,
} from "./message-sheet";

const booking = (id: string, title: string, travel: string, status: PortalBookingListItem["trip_status"] = "upcoming"): PortalBookingListItem => ({
  id,
  title,
  destination: "Spain",
  hotel: "Hotel",
  price: 1000,
  price_per_person: 500,
  travel_date: travel,
  return_date: null,
  nights: 7,
  booking_reference: "HAY-1234567",
  image_url: "",
  documents_url: "#",
  supplier_reference: null,
  operator_name: null,
  board: null,
  adults: 2,
  children: 0,
  infants: 0,
  trip_status: status,
  days_to_go: 10,
});

const quote = (id: string, hotel: string, declined = false): PortalQuoteListItem => ({
  id,
  token: `tok-${id}`,
  title: `${hotel} title`,
  destination: "Spain",
  hotel,
  operator_name: null,
  price: 1000,
  price_per_person: 500,
  travel_date: "2027-07-01",
  return_date: null,
  nights: 7,
  board: null,
  adults: 2,
  children: 0,
  infants: 0,
  expiry_date: null,
  sent_at: null,
  image_url: "",
  photo_count: 0,
  quote_url: "",
  decision: { state: declined ? "declined" : "none", reason: null, note: null, wantsSimilar: null, at: null },
});

describe("buildAboutOptions", () => {
  it("lists upcoming bookings soonest first, then open quotes by hotel, then Something else", () => {
    const options = buildAboutOptions({
      bookings: [booking("b2", "Later trip", "2027-09-01"), booking("b1", "Sooner trip", "2027-06-01"), booking("b0", "Old trip", "2020-01-01", "past")],
      quotes: [quote("q1", "Hotel Playa"), quote("q2", "Hotel Roma", true)],
    });
    expect(options.map((o) => o.label)).toEqual(["Sooner trip", "Later trip", "Hotel Playa", "Something else"]);
    expect(options.map((o) => o.key)).toEqual(["booking:b1", "booking:b2", "quote:q1", "other"]);
  });
  it("keeps the open quotes in the order the list gives them (it does not re-sort them), after the booking, so one step down from the default booking is the list's first quote", () => {
    const options = buildAboutOptions({
      bookings: [booking("b1", "Lisbon", "2027-06-01")],
      quotes: [quote("q-new", "Algarve"), quote("q-old", "Tenerife")], // the server sends newest first
    });
    expect(options.map((o) => o.key)).toEqual(["booking:b1", "quote:q-new", "quote:q-old", "other"]);
    expect(defaultAboutKey(options)).toBe("booking:b1");
    expect(options[options.findIndex((o) => o.key === defaultAboutKey(options)) + 1].key).toBe("quote:q-new");
  });
  it("offers only Something else when there is nothing", () => {
    expect(buildAboutOptions({ bookings: undefined, quotes: undefined }).map((o) => o.key)).toEqual(["other"]);
  });
  it("still offers the summary's next booking when the list has not delivered it", () => {
    const options = buildAboutOptions({
      bookings: [],
      quotes: [],
      nextBooking: { id: "b9", title: "Next trip", destination: "Italy", startDate: "2027-01-01", endDate: null, nights: null, board: null, adults: 2, children: 0, infants: 0, imageUrl: "", daysToGo: 3 },
    });
    expect(options.map((o) => o.key)).toEqual(["booking:b9", "other"]);
  });
});

describe("preselection", () => {
  const options = buildAboutOptions({ bookings: [booking("b1", "Trip", "2027-06-01")], quotes: [quote("q1", "Hotel Playa")] });
  it("defaults to the next booking, else the first quote, else Something else", () => {
    expect(defaultAboutKey(options)).toBe("booking:b1");
    expect(defaultAboutKey(buildAboutOptions({ bookings: [], quotes: [quote("q1", "Hotel Playa")] }))).toBe("quote:q1");
    expect(defaultAboutKey(buildAboutOptions({ bookings: [], quotes: [] }))).toBe("other");
  });
  it("honours a named booking, quote id or quote token, else the default when nothing in particular was asked", () => {
    expect(resolveAbout(options, "quote:q1").label).toBe("Hotel Playa");
    expect(resolveAbout(options, "quote-token:tok-q1").key).toBe("quote:q1");
    expect(resolveAbout(options, null).key).toBe("booking:b1");
    expect(resolveAbout(options, "other").key).toBe("other");
  });
  it("never swaps a named booking or quote that cannot be found for a different trip: it falls back to Something else", () => {
    expect(resolveAbout(options, "booking:gone").key).toBe("other");
    expect(resolveAbout(options, "quote:gone").key).toBe("other");
    expect(resolveAbout(options, "quote-token:nope").key).toBe("other");
  });
  it("includes the page's own item when the list leaves it out (a declined quote, a past booking) as the first and chosen subject", () => {
    const bookings = [booking("b1", "Trip", "2027-06-01"), booking("b0", "Old trip", "2020-01-01", "past")];
    const quotes = [quote("q1", "Hotel Playa"), quote("q2", "Hotel Roma", true)];

    const declined = buildAboutOptions({ bookings, quotes, preferred: "quote-token:tok-q2" });
    expect(declined.map((o) => o.key)).toEqual(["quote:q2", "booking:b1", "quote:q1", "other"]);
    expect(resolveAbout(declined, "quote-token:tok-q2")).toMatchObject({ key: "quote:q2", label: "Hotel Roma" });
    expect(resolveAbout(buildAboutOptions({ bookings, quotes, preferred: "quote:q2" }), "quote:q2").label).toBe("Hotel Roma");

    const past = buildAboutOptions({ bookings, quotes, preferred: "booking:b0" });
    expect(resolveAbout(past, "booking:b0")).toMatchObject({ key: "booking:b0", label: "Old trip" });
  });
  it("adds nothing for an item the lists do not hold, and nothing twice for one they do", () => {
    const bookings = [booking("b1", "Trip", "2027-06-01")];
    const quotes = [quote("q1", "Hotel Playa")];
    expect(buildAboutOptions({ bookings, quotes, preferred: "quote-token:unknown" }).map((o) => o.key)).toEqual(["booking:b1", "quote:q1", "other"]);
    expect(buildAboutOptions({ bookings, quotes, preferred: "quote:q1" }).map((o) => o.key)).toEqual(["booking:b1", "quote:q1", "other"]);
  });
  it("reads a quote or booking screen from the address", () => {
    expect(aboutFromPath("/portal/quote/abc")).toBe("quote-token:abc");
    expect(aboutFromPath("/portal/booking/b1/")).toBe("booking:b1");
    expect(aboutFromPath("/portal/bookings")).toBeNull();
    expect(aboutFromPath("/portal")).toBeNull();
  });
});

describe("the message", () => {
  it("needs some words or one chip", () => {
    expect(validateDraft({ extras: [], text: "   " })).toBe(EMPTY_MESSAGE_ERROR);
    expect(validateDraft({ extras: [], text: "Hi" })).toBe("");
    expect(validateDraft({ extras: ["Airport parking"], text: "" })).toBe("");
  });
  it("is written one part per line, extras in the design's order, empty parts left out", () => {
    const text = composeMessage({ about: "Hotel Playa", draft: { extras: ["Airport parking", "Room with a view"], text: " Sea view please ", via: "whatsapp" } });
    expect(text).toBe("About: Hotel Playa\nWould like: Room with a view, Airport parking\nSea view please\nReply by: WhatsApp");
    expect(composeMessage({ about: "Something else", draft: { ...EMPTY_DRAFT, extras: ["Extra luggage"] } })).toBe("About: Something else\nWould like: Extra luggage\nReply by: Email");
  });
  it("stays far under the server's 5000 characters", () => {
    expect(composeMessage({ about: "x".repeat(900), draft: { ...EMPTY_DRAFT, text: "y".repeat(9000) } }).length).toBeLessThan(MAX_MESSAGE_TEXT + 400);
  });
});

describe("sent state wording", () => {
  it("names the reply channel, and a call for the phone choice", () => {
    expect(replyLine("James", "email")).toBe("James will reply by email, and you’ll see it here too.");
    expect(replyLine("James", "whatsapp")).toBe("James will reply by WhatsApp, and you’ll see it here too.");
    expect(replyLine("James", "call")).toBe("James will give you a call to talk it through.");
    expect(replyLine("your agent", "email")).toContain("Your agent will reply by email");
  });
  it("stamps the time and makes initials", () => {
    expect(sentStamp(new Date(2027, 0, 1, 9, 5))).toBe("today at 09:05");
    expect(agentInitials("James Lee")).toBe("JL");
    expect(agentInitials("Tina")).toBe("T");
    expect(agentInitials("")).toBe("A");
  });
});
