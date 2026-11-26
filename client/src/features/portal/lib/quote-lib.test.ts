import { describe, expect, it } from "vitest";
import { NO_DECISION, type PortalQuoteDecision, type PortalQuoteListItem } from "@shared/portal-quotes";
import { splitTitle } from "./quote-title";
import { daysLeft, heldUntilLine } from "./quote-held";
import {
  INITIAL_DECLINE_FORM,
  applyDecisionToList,
  canShowDecisionControls,
  declineFormReducer,
  declinedSentence,
  optimisticDecision,
  splitQuotes,
} from "./quote-decision";
import { factsLine, formatClock, formatDay, formatMoney, formatRange, paxLabel, toRoman } from "./quote-format";
import { mailtoHref, shareMessage, shareNotice, shareUrl, smsHref, whatsAppHref } from "./quote-share";
import { buildDestination } from "./quote-destination";

describe("splitTitle", () => {
  it("puts the last two words in italics", () => {
    expect(splitTitle("Gran Melia Palace Resort")).toEqual({ lead: "Gran Melia", italic: "Palace Resort" });
    expect(splitTitle("Sunset Beach Resort and Spa Tenerife")).toEqual({ lead: "Sunset Beach Resort and", italic: "Spa Tenerife" });
  });

  it("a three-word title keeps one word on the first line", () => {
    expect(splitTitle("Hotel Roma Centrale")).toEqual({ lead: "Hotel", italic: "Roma Centrale" });
  });

  it("two words go one per line; one word stays whole; nothing stays empty", () => {
    expect(splitTitle("Hotel Roma")).toEqual({ lead: "Hotel", italic: "Roma" });
    expect(splitTitle("Rome")).toEqual({ lead: "Rome", italic: "" });
    expect(splitTitle("   ")).toEqual({ lead: "", italic: "" });
  });

  it("drops commas and collapses spaces so long names wrap cleanly", () => {
    expect(splitTitle("Hotel Roma,  Rome, Italy")).toEqual({ lead: "Hotel Roma", italic: "Rome Italy" });
  });
});

describe("heldUntilLine", () => {
  const now = new Date("2026-11-24T12:00:00Z");

  it("is null when the quote has no real expiry date (nothing is invented)", () => {
    expect(heldUntilLine(null, now)).toBeNull();
    expect(heldUntilLine(undefined, now)).toBeNull();
    expect(heldUntilLine("", now)).toBeNull();
    expect(heldUntilLine("not a date", now)).toBeNull();
  });

  it("counts UK days to the expiry", () => {
    expect(heldUntilLine("2026-12-01T12:00:00Z", now)).toEqual({ held: true, text: "Price held for 7 more days, until 1 Dec 2026" });
    expect(heldUntilLine("2026-11-25T12:00:00Z", now)).toEqual({ held: true, text: "Price held until tomorrow, 25 Nov 2026" });
    expect(heldUntilLine("2026-11-24T20:00:00Z", now)).toEqual({ held: true, text: "Price held until today, 24 Nov 2026" });
  });

  it("says plainly when the held price has ended", () => {
    expect(heldUntilLine("2026-11-20T12:00:00Z", now)).toEqual({ held: false, text: "The held price ended on 20 Nov 2026" });
  });

  it("uses the UK calendar day, not UTC, around midnight", () => {
    // 23:30 UTC on 30 Jun is already 1 Jul in the UK (BST).
    expect(heldUntilLine("2026-06-30T23:30:00Z", new Date("2026-06-30T10:00:00Z"))?.text).toBe("Price held until tomorrow, 1 Jul 2026");
  });

  it("daysLeft agrees", () => {
    expect(daysLeft("2026-12-01T12:00:00Z", now)).toBe(7);
    expect(daysLeft("2026-11-20T12:00:00Z", now)).toBeNull();
    expect(daysLeft(null, now)).toBeNull();
  });
});

const item = (id: string, decision: PortalQuoteDecision = { ...NO_DECISION }): PortalQuoteListItem => ({
  id, token: id, title: id, destination: "", hotel: "", operator_name: null, price: 1, price_per_person: 1, travel_date: "2026-12-01",
  return_date: "2026-12-08", nights: 7, board: null, adults: 2, children: 0, infants: 0, expiry_date: null, sent_at: null, image_url: "",
  photo_count: 0, quote_url: "", decision,
});

describe("decision selectors and reducer", () => {
  const declined: PortalQuoteDecision = { state: "declined", reason: "Wrong dates", note: null, wantsSimilar: true, at: "2026-11-24T10:00:00Z" };
  const interested: PortalQuoteDecision = { state: "interested", reason: null, note: null, wantsSimilar: null, at: "2026-11-24T10:00:00Z" };

  it("splitQuotes puts declined quotes in their own list and keeps interested ones active", () => {
    const { active, declined: gone } = splitQuotes([item("a"), item("b", declined), item("c", interested)]);
    expect(active.map((q) => q.id)).toEqual(["a", "c"]);
    expect(gone.map((q) => q.id)).toEqual(["b"]);
  });

  it("applyDecisionToList changes only the named quote, and Undo (reopened) puts it back", () => {
    const start = [item("a"), item("b")];
    const after = applyDecisionToList(start, "b", declined);
    expect(after[0]).toBe(start[0]);
    expect(after[1].decision.state).toBe("declined");
    expect(splitQuotes(applyDecisionToList(after, "b", optimisticDecision("reopened"))).declined).toEqual([]);
  });

  it("optimisticDecision mirrors what the server will record", () => {
    expect(optimisticDecision("interested", { note: "  sea view " })).toMatchObject({ state: "interested", note: "sea view" });
    expect(optimisticDecision("declined", { reason: "Too expensive" })).toMatchObject({ state: "declined", reason: "Too expensive", wantsSimilar: true });
    expect(optimisticDecision("declined", { wantsSimilar: false }).wantsSimilar).toBe(false);
    expect(optimisticDecision("reopened")).toEqual(NO_DECISION);
  });

  it("the decision controls show only to the owner while nothing is decided", () => {
    expect(canShowDecisionControls({ canDecide: true, decision: { ...NO_DECISION } })).toBe(true);
    expect(canShowDecisionControls({ canDecide: true, decision: interested })).toBe(false);
    expect(canShowDecisionControls({ canDecide: true, decision: declined })).toBe(false);
    expect(canShowDecisionControls({ canDecide: false, decision: { ...NO_DECISION } })).toBe(false);
  });

  it("declinedSentence names the agent, the reason and the similar promise", () => {
    expect(declinedSentence(declined, "Sam")).toBe("You told Sam this one isn't for you: wrong dates. Sam will look for something similar.");
    expect(declinedSentence({ ...declined, reason: null, wantsSimilar: false }, "your agent")).toBe("You told your agent this one isn't for you.");
  });

  it("the decline form starts with 'something similar' on, toggles a reason off by choosing it again, and ignores unknown reasons", () => {
    expect(INITIAL_DECLINE_FORM).toEqual({ reason: "", note: "", wantsSimilar: true });
    let s = declineFormReducer(INITIAL_DECLINE_FORM, { type: "reason", reason: "Too expensive" });
    expect(s.reason).toBe("Too expensive");
    s = declineFormReducer(s, { type: "reason", reason: "Wrong dates" });
    expect(s.reason).toBe("Wrong dates");
    s = declineFormReducer(s, { type: "reason", reason: "Wrong dates" });
    expect(s.reason).toBe("");
    expect(declineFormReducer(s, { type: "reason", reason: "Nonsense" })).toBe(s);
    s = declineFormReducer(s, { type: "note", note: "Cheaper please" });
    s = declineFormReducer(s, { type: "similar", value: false });
    expect(s).toEqual({ reason: "", note: "Cheaper please", wantsSimilar: false });
    expect(declineFormReducer(s, { type: "reset" })).toEqual(INITIAL_DECLINE_FORM);
  });
});

describe("formatting", () => {
  it("money, dates, ranges and times read as written", () => {
    expect(formatMoney(1150)).toBe("£1,150.00");
    expect(formatDay("2026-12-01T00:30:00.000Z")).toBe("1 Dec 2026");
    expect(formatDay(null)).toBe("");
    expect(formatDay("garbage")).toBe("");
    expect(formatClock("2026-12-01T07:05:00.000Z")).toBe("07:05");
    expect(formatClock("2026-12-01")).toBe("");
    expect(formatRange("2026-12-01", "2026-12-08")).toBe("1 Dec 2026 to 8 Dec 2026");
    expect(formatRange("2026-12-01", null)).toBe("1 Dec 2026");
    expect(formatRange(null, null)).toBe("");
  });

  it("passengers and the facts line leave out what is not known", () => {
    expect(paxLabel(2, 1, 1)).toBe("2 adults, 1 child, 1 infant");
    expect(paxLabel(1, 0)).toBe("1 adult");
    expect(factsLine(7, "All Inclusive", "2 adults")).toBe("7 nights · All Inclusive · 2 adults");
    expect(factsLine(null, null, "2 adults")).toBe("2 adults");
    expect(factsLine(1, null, "")).toBe("1 night");
  });

  it("roman numerals", () => {
    expect([1, 2, 4, 9, 14, 39].map(toRoman)).toEqual(["I", "II", "IV", "IX", "XIV", "XXXIX"]);
    expect(toRoman(40)).toBe("40");
  });
});

describe("sharing", () => {
  const url = shareUrl("https://app.example.com/", "AB12CD");

  it("uses the existing public link for the quote", () => {
    expect(url).toBe("https://app.example.com/view-quote/AB12CD");
  });

  it("the message carries the title, dates and link, and names the agency only when known", () => {
    expect(shareMessage({ title: "Hotel Roma", dates: "1 Dec 2026 to 8 Dec 2026", url })).toBe(
      "Take a look at this holiday: Hotel Roma, 1 Dec 2026 to 8 Dec 2026. https://app.example.com/view-quote/AB12CD",
    );
    expect(shareMessage({ title: "Hotel Roma", dates: "", url, agencyName: "Sunny Travel" })).toContain("holiday from Sunny Travel: Hotel Roma.");
  });

  it("builds WhatsApp, text and email links with the text encoded", () => {
    expect(whatsAppHref("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
    expect(smsHref("a b")).toBe("sms:?&body=a%20b");
    expect(mailtoHref("A holiday", "x y")).toBe("mailto:?subject=A%20holiday&body=x%20y");
  });

  it("says plainly what the recipient can see", () => {
    expect(shareNotice("Sam")).toBe("Anyone with the link can see the photos, the itinerary and the price. Only you can tell Sam you're interested.");
  });
});

describe("buildDestination", () => {
  it("returns null for no guide, bad JSON, or a guide with nothing in it", () => {
    expect(buildDestination(null)).toBeNull();
    expect(buildDestination({ destination: "Rome", country: "Italy", data: "{not json" })).toBeNull();
    expect(buildDestination({ destination: "Rome", country: "Italy", data: {} })).toBeNull();
    expect(buildDestination({ destination: "Rome", country: "Italy", data: { travelInfo: {}, mustDo: [] } })).toBeNull();
  });

  it("builds only the sections that have content", () => {
    const d = buildDestination({
      destination: "Rome",
      country: "Italy",
      data: JSON.stringify({
        tagline: "The eternal city",
        travelInfo: { currency: "Euro", plugType: "C and L", visaRequired: "" },
        mustDo: [{ rank: 1, name: "Colosseum", category: "History", shortDesc: "Ancient arena", price: "£20", tips: "Go early" }, { name: "" }],
      }),
    });
    expect(d?.name).toBe("Rome");
    expect(d?.tagline).toBe("The eternal city");
    expect(d?.sections.map((s) => s.id)).toEqual(["todo", "know"]);
    const todo = d?.sections[0];
    expect(todo?.id === "todo" && todo.things).toEqual([
      { name: "Colosseum", tag: "History", line: "Ancient arena", details: ["Price: £20", "Tip: Go early"] },
    ]);
    const know = d?.sections[1];
    expect(know?.id === "know" && know.facts).toEqual([{ label: "Currency", value: "Euro" }, { label: "Plugs", value: "C and L" }]);
  });

  it("reads when-to-go and getting-there content, from an object as well as a string", () => {
    const d = buildDestination({
      destination: "Rome",
      country: null,
      data: {
        bestTimeToVisit: { months: "April to June", reason: "Mild", peakSeason: "July" },
        temperatures: [{ month: "Jan", avgHigh: 12, avgLow: 4, rainfall: 60 }, { month: "Bad" }],
        flightTimesFromUK: { directHours: "2h 30", airports: ["MAN", "LHR"], airlines: [], tips: "Book early" },
      },
    });
    expect(d?.sections.map((s) => s.id)).toEqual(["when", "getting"]);
    const when = d?.sections[0];
    expect(when?.id === "when" && when.months).toEqual([{ month: "Jan", high: 12, low: 4, rainfall: 60 }]);
    const getting = d?.sections[1];
    expect(getting?.id === "getting" && getting.facts).toEqual([{ label: "Flight time", value: "2h 30" }, { label: "UK airports", value: "MAN, LHR" }]);
  });
});

import { aboutParam, prefillFromSearch } from "./message-prefill";
import { agentFirstName } from "./quote-format";

describe("message prefill", () => {
  it("starts the composer with the quote title", () => {
    expect(prefillFromSearch(`?about=${aboutParam("Hotel Roma, Rome")}`)).toBe("About Hotel Roma, Rome: ");
    expect(prefillFromSearch("")).toBe("");
    expect(prefillFromSearch("?about=")).toBe("");
    expect(prefillFromSearch("?other=1")).toBe("");
  });

  it("bounds a very long title", () => {
    expect(prefillFromSearch(`?about=${aboutParam("x".repeat(500))}`)).toBe(`About ${"x".repeat(120)}: `);
  });
});

describe("agentFirstName", () => {
  it("uses the first name, or the fallback when there is no real name", () => {
    expect(agentFirstName("Sam Agent")).toBe("Sam");
    expect(agentFirstName("  Sam  ")).toBe("Sam");
    expect(agentFirstName("Your Travel Agent")).toBe("your agent");
    expect(agentFirstName(null)).toBe("your agent");
    expect(agentFirstName("", "us")).toBe("us");
  });
});

import { uniqueNames } from "./quote-format";

describe("uniqueNames", () => {
  it("drops blanks and repeats, keeping first-seen order", () => {
    expect(uniqueNames(["Hotel Playa Azul", "Hotel Playa Azul", " ", null, "Hotel Roma"])).toEqual(["Hotel Playa Azul", "Hotel Roma"]);
    expect(uniqueNames([])).toEqual([]);
  });
});
