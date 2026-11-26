import { describe, it, expect } from "vitest";
import { NO_DECISION, type PortalQuoteListItem } from "@shared/portal-quotes";
import type { PortalSummary } from "@shared/portal-summary";
import {
  dealTag,
  fitHeroSize,
  greetingFor,
  heroPhoto,
  homeSections,
  isDealExpiringSoon,
  journeyPlace,
  journeyWhen,
  mergeDeals,
  nextHolidayParts,
  nextHolidaySentence,
  nightsBoardLine,
  plural,
  priceHeldLine,
  rewardsTitle,
  splitName,
  ukHour,
} from "./home";

const quote = (id: string, over: Partial<PortalQuoteListItem> = {}): PortalQuoteListItem => ({
  id, token: `T${id}`, title: `Quote ${id}`, destination: "Rome, Italy", hotel: "", operator_name: null, price: 1500, price_per_person: 750,
  travel_date: "2027-01-01", return_date: "2027-01-08", nights: 7, board: null, adults: 2, children: 0, infants: 0, expiry_date: null,
  sent_at: null, image_url: "", photo_count: 0, quote_url: `/portal/quote/T${id}`, decision: { ...NO_DECISION }, ...over,
});

const summary = (over: Partial<PortalSummary> = {}): PortalSummary => ({
  firstName: "Pat",
  counts: { quotesAwaiting: 0, upcomingBookings: 0 },
  nextBooking: null,
  priceHeld: null,
  rewards: { walletCredit: 0, rewardWaiting: false },
  toldDealIds: [],
  ...over,
});

const booking = { id: "b", title: "Trip", destination: "Majorca, Spain", startDate: "2027-06-14", endDate: "2027-06-21", nights: 7, board: null, adults: 2, children: 0, infants: 0, imageUrl: "/b.jpg", daysToGo: 12 };

describe("greeting by UK hour", () => {
  it("morning, afternoon and evening change at 12:00 and 18:00 UK time", () => {
    expect(greetingFor(new Date("2026-12-01T05:59:00Z"))).toBe("Good morning");
    expect(greetingFor(new Date("2026-12-01T11:59:00Z"))).toBe("Good morning");
    expect(greetingFor(new Date("2026-12-01T12:00:00Z"))).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-12-01T17:59:00Z"))).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-12-01T18:00:00Z"))).toBe("Good evening");
    expect(greetingFor(new Date("2026-12-01T00:30:00Z"))).toBe("Good morning");
  });

  it("uses UK summer time, not UTC: 11:30 UTC in June is 12:30 in the UK", () => {
    expect(ukHour(new Date("2026-06-15T11:30:00Z"))).toBe(12);
    expect(greetingFor(new Date("2026-06-15T11:30:00Z"))).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-06-15T16:59:00Z"))).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-06-15T17:00:00Z"))).toBe("Good evening");
  });

  it("treats the hour after UK midnight as morning", () => {
    expect(ukHour(new Date("2026-06-15T23:30:00Z"))).toBe(0);
    expect(greetingFor(new Date("2026-06-15T23:30:00Z"))).toBe("Good morning");
  });
});

describe("wording", () => {
  it("pluralises", () => {
    expect(plural(1, "quote")).toBe("quote");
    expect(plural(0, "quote")).toBe("quotes");
    expect(plural(2, "holiday", "holidays")).toBe("holidays");
  });

  it("splits the name over two lines, with a welcome when there is none", () => {
    expect(splitName("Pat", "Portal")).toEqual({ lead: "Pat", italic: "Portal" });
    expect(splitName(" Pat ", null)).toEqual({ lead: "Pat", italic: "" });
    expect(splitName(null, "Portal")).toEqual({ lead: "Portal", italic: "" });
    expect(splitName("", "")).toEqual({ lead: "Welcome", italic: "back." });
    expect(splitName(undefined, undefined)).toEqual({ lead: "Welcome", italic: "back." });
  });

  it("says how far away the next holiday is", () => {
    expect(nextHolidaySentence(12)).toBe("Your next holiday is 12 days away.");
    expect(nextHolidaySentence(1)).toBe("Your next holiday starts tomorrow.");
    expect(nextHolidaySentence(0)).toBe("Your next holiday starts today.");
    expect(journeyWhen(30)).toBe("in 30 days.");
    expect(journeyWhen(1)).toBe("tomorrow.");
    expect(journeyWhen(0)).toBe("today.");
  });

  it("splits the next-holiday sentence so only the figure can be emphasised", () => {
    for (const n of [12, 1, 0]) {
      const p = nextHolidayParts(n);
      expect(p.before + p.strong + p.after).toBe(nextHolidaySentence(n));
    }
    expect(nextHolidayParts(12).strong).toBe("12 days");
    expect(nextHolidayParts(1).strong).toBe("tomorrow");
  });

  it("writes the nights-and-board line for the next-journey card", () => {
    expect(nightsBoardLine(7, "All Inclusive")).toBe("7 nights, all inclusive");
    expect(nightsBoardLine(1, null)).toBe("1 night");
    expect(nightsBoardLine(null, "Half Board")).toBe("half board");
    expect(nightsBoardLine(null, null)).toBe("");
  });

  it("words the held price with the right plural and the last day", () => {
    expect(priceHeldLine(9, 2400)).toBe("9 days left at £2,400.00");
    expect(priceHeldLine(1, 2400)).toBe("1 day left at £2,400.00");
    expect(priceHeldLine(0, 2400)).toBe("Last day at £2,400.00");
  });

  it("titles the rewards card from what is real", () => {
    expect(rewardsTitle(25.5, false)).toBe("£25.50 in your wallet");
    expect(rewardsTitle(25.5, true)).toBe("£25.50 in your wallet");
    expect(rewardsTitle(0, true)).toBe("A reward is waiting");
  });

  it("names the place for the journey heading", () => {
    expect(journeyPlace("Majorca, Spain", "Trip")).toBe("Majorca");
    expect(journeyPlace("TBC", "Hotel Roma")).toBe("Hotel Roma");
    expect(journeyPlace("Spain", "Trip")).toBe("Spain");
  });
});

describe("which sections render", () => {
  const base = { forYouCount: 0, latestCount: 0, interestCount: 2 };

  it("a customer with nothing real gets no coming-up, rows, journey or quotes rail, and the first-time version", () => {
    const s = homeSections({ ...base, summary: summary(), quotes: [] });
    expect(s).toMatchObject({ comingUp: [], quoteRow: false, bookingRow: false, journey: false, quotesRail: false, firstTime: true });
  });

  it("is not the first-time version while the quotes are unknown (a failed load)", () => {
    expect(homeSections({ ...base, summary: summary(), quotes: undefined }).firstTime).toBe(false);
  });

  it("is not the first-time version with an upcoming holiday or a quote", () => {
    expect(homeSections({ ...base, summary: summary({ counts: { quotesAwaiting: 0, upcomingBookings: 1 } }), quotes: [] }).firstTime).toBe(false);
    expect(homeSections({ ...base, summary: summary(), quotes: [quote("1")] }).firstTime).toBe(false);
  });

  it("shows a row only when its count is above zero", () => {
    const s = homeSections({ ...base, summary: summary({ counts: { quotesAwaiting: 2, upcomingBookings: 0 } }), quotes: [quote("1"), quote("2")] });
    expect(s.quoteRow).toBe(true);
    expect(s.bookingRow).toBe(false);
    const t = homeSections({ ...base, summary: summary({ counts: { quotesAwaiting: 0, upcomingBookings: 3 } }), quotes: [] });
    expect(t.quoteRow).toBe(false);
    expect(t.bookingRow).toBe(true);
  });

  it("coming up has a card per real thing, never a balance or passport card", () => {
    const priceHeld = { token: "T1", title: "Rome", total: 1500, expiresAt: "2026-12-05T10:00:00Z", expiresOn: "2026-12-05", daysLeft: 11 };
    expect(homeSections({ ...base, summary: summary({ priceHeld }), quotes: [] }).comingUp).toEqual(["priceHeld"]);
    expect(homeSections({ ...base, summary: summary({ rewards: { walletCredit: 10, rewardWaiting: false } }), quotes: [] }).comingUp).toEqual(["rewards"]);
    expect(homeSections({ ...base, summary: summary({ priceHeld, rewards: { walletCredit: 0, rewardWaiting: true } }), quotes: [] }).comingUp).toEqual(["priceHeld", "rewards"]);
    const all = homeSections({ ...base, summary: summary({ priceHeld, rewards: { walletCredit: 10, rewardWaiting: true } }), quotes: [] }).comingUp;
    expect(all.join(" ")).not.toMatch(/balance|passport/i);
  });

  it("the journey needs a next booking", () => {
    expect(homeSections({ ...base, summary: summary({ nextBooking: booking }), quotes: [] }).journey).toBe(true);
  });

  it("the quotes rail leaves out quotes the customer said are not for them", () => {
    const declined = quote("d", { decision: { ...NO_DECISION, state: "declined" } });
    expect(homeSections({ ...base, summary: summary(), quotes: [declined] }).quotesRail).toBe(false);
    expect(homeSections({ ...base, summary: summary(), quotes: [declined, quote("1")] }).quotesRail).toBe(true);
  });

  it("deals rails follow the deal counts, and the interests line shows only without interests", () => {
    const s = homeSections({ summary: summary(), quotes: [], forYouCount: 2, latestCount: 0, interestCount: 0 });
    expect(s).toMatchObject({ forYou: true, latest: false, interestsNudge: true });
    expect(homeSections({ ...base, summary: summary(), quotes: [], latestCount: 1 })).toMatchObject({ forYou: false, latest: true, interestsNudge: false });
  });
});

describe("hero photo", () => {
  it("prefers the next holiday's photo, then the first quote that has one, else none", () => {
    expect(heroPhoto(summary({ nextBooking: booking }), [quote("1", { image_url: "/q.jpg" })])).toBe("/b.jpg");
    expect(heroPhoto(summary(), [quote("1"), quote("2", { image_url: "/q.jpg" })])).toBe("/q.jpg");
    expect(heroPhoto(summary({ nextBooking: { ...booking, imageUrl: "" } }), [])).toBeUndefined();
  });
});

describe("deals", () => {
  it("flags a deal in its last day on the portal only", () => {
    const now = new Date("2026-12-10T12:00:00Z");
    expect(isDealExpiringSoon("2026-12-04T12:00:00Z", now)).toBe(false); // 6 days: already gone
    expect(isDealExpiringSoon("2026-12-05T12:00:00Z", now)).toBe(true); // 5 days
    expect(isDealExpiringSoon("2026-12-09T12:00:00Z", now)).toBe(false);
    expect(isDealExpiringSoon(null, now)).toBe(false);
    expect(isDealExpiringSoon("junk", now)).toBe(false);
  });

  it("lists latest deals after 'for you' without repeating any", () => {
    const merged = mergeDeals([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]);
    expect(merged.forYou.map((d) => d.id)).toEqual(["a", "b"]);
    expect(merged.latest.map((d) => d.id)).toEqual(["c"]);
  });

  it("tags a deal with one of the customer's interests first", () => {
    expect(dealTag(["Beach", "Golf"], ["Golf"])).toBe("Golf");
    expect(dealTag(["Beach", "Golf"], [])).toBe("Beach");
    expect(dealTag([], ["Golf"])).toBe("");
  });

});

describe("hero heading size", () => {
  it("keeps the base size for short words and steps down as the longest word grows", () => {
    expect(fitHeroSize(48, "Pat Portal")).toBe(48);
    expect(fitHeroSize(48, "Pat Wolfeschle")).toBe(38); // longest word 10 letters
    expect(fitHeroSize(48, "Pat Wolfeschlegel")).toBe(30); // 13 letters
    expect(fitHeroSize(42, "Hotel Playa Azul Majorca")).toBe(42);
    expect(fitHeroSize(42, "Pneumonoultramicroscopic")).toBe(26);
  });
});
