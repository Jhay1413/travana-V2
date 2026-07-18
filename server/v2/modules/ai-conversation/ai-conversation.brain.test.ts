import { describe, it, expect } from "vitest";
import {
  buildRulesBlock,
  decideDeterministicRoute,
  inferHolidayTypeFromText,
  isAcknowledgement,
  looksLikeActionableAdmin,
  looksLikeAdminAsk,
  MAX_ENQUIRY_ASKS,
  missingCoreFieldsFor,
  normalizeTurnSlots,
  parseBotRules,
  shouldForceTicketNow,
  type BotRule,
} from "./ai-conversation.brain";
import type { EnquirySlots } from "./ai-conversation.types";

describe("looksLikeAdminAsk", () => {
  it("matches a read-only query about the customer's own records", () => {
    expect(looksLikeAdminAsk("what's the status of my enquiry?")).toBe(true);
    expect(looksLikeAdminAsk("can you check my latest quote")).toBe(true);
    expect(looksLikeAdminAsk("can I see my ticket please")).toBe(true);
    expect(looksLikeAdminAsk("where's my file for the passport application")).toBe(true);
  });

  it("matches the actionable subset too (complaints, providing details)", () => {
    expect(looksLikeAdminAsk("my room is filthy, I want a refund")).toBe(true);
    expect(looksLikeAdminAsk("here's my passport number: A1234567")).toBe(true);
  });

  it("does not match a new sales enquiry or plain chatter", () => {
    expect(looksLikeAdminAsk("I'd like to book a holiday to Benidorm")).toBe(false);
    expect(looksLikeAdminAsk("we want to book 2 weeks in September")).toBe(false);
    expect(looksLikeAdminAsk("hi there, how are you")).toBe(false);
    expect(looksLikeAdminAsk("thanks")).toBe(false);
  });
});

describe("looksLikeActionableAdmin", () => {
  it("matches explicit complaint / dissatisfaction language", () => {
    expect(looksLikeActionableAdmin("my room is filthy, I want a refund")).toBe(true);
    expect(looksLikeActionableAdmin("the hotel was disgusting and unhygienic")).toBe(true);
    expect(looksLikeActionableAdmin("I want to complain about my last trip")).toBe(true);
    expect(looksLikeActionableAdmin("there were cockroaches everywhere")).toBe(true);
    expect(looksLikeActionableAdmin("bed bugs in the room, not happy at all")).toBe(true);
  });

  it("matches the customer providing a verification identifier / DOB", () => {
    expect(looksLikeActionableAdmin("booking reference number 12345")).toBe(true);
    expect(looksLikeActionableAdmin("my reference number is 998877")).toBe(true);
    expect(looksLikeActionableAdmin("here's my passport number: A1234567")).toBe(true);
    expect(looksLikeActionableAdmin("here's my id number 123456")).toBe(true);
    expect(looksLikeActionableAdmin("my date of birth is 01/01/1990")).toBe(true);
    expect(looksLikeActionableAdmin("dob: 01/01/1990")).toBe(true);
    expect(looksLikeActionableAdmin("my account number is 5551234")).toBe(true);
  });

  it("does NOT match a merely admin-ish but read-only query (stays sales-sticky / non-actionable)", () => {
    expect(looksLikeActionableAdmin("what's the status of my enquiry?")).toBe(false);
    expect(looksLikeActionableAdmin("can you check my latest quote")).toBe(false);
    expect(looksLikeActionableAdmin("my booking reference is 12345")).toBe(false); // "reference" not followed by number/no/#
    expect(looksLikeActionableAdmin("can I see my ticket please")).toBe(false);
  });

  it("does not match a fresh sales enquiry or a free-text answer with no deterministic signal", () => {
    expect(looksLikeActionableAdmin("I'd like to book a holiday to Benidorm")).toBe(false);
    expect(looksLikeActionableAdmin("BK-12345, room 204")).toBe(false);
    expect(looksLikeActionableAdmin("thanks")).toBe(false);
  });
});

describe("isAcknowledgement", () => {
  it("matches bare acknowledgements", () => {
    expect(isAcknowledgement("thanks")).toBe(true);
    expect(isAcknowledgement("ok")).toBe(true);
    expect(isAcknowledgement("OK!")).toBe(true);
    expect(isAcknowledgement("Thank you!")).toBe(true);
    expect(isAcknowledgement("cheers!")).toBe(true);
    expect(isAcknowledgement("no worries")).toBe(true);
    expect(isAcknowledgement("got it")).toBe(true);
  });

  it("does not match a compound reply that layers an ack word onto more text", () => {
    // ACK_RE anchors the WHOLE trimmed string to a single ack phrase plus
    // trailing punctuation/emoji only — "great thanks!" has two words, so it
    // is NOT recognised as a bare acknowledgement (it's treated as substantive).
    expect(isAcknowledgement("great thanks!")).toBe(false);
    expect(isAcknowledgement("thanks so much")).toBe(false);
  });

  it("does not match substantive replies", () => {
    expect(isAcknowledgement("BK-12345, room 204")).toBe(false);
    expect(isAcknowledgement("my room is filthy, I want a refund")).toBe(false);
    expect(isAcknowledgement("")).toBe(false);
  });
});

describe("shouldForceTicketNow (Phase 3.1 gate)", () => {
  it("fires when the current turn is deterministically actionable after adminAsked", () => {
    expect(
      shouldForceTicketNow({ adminAsked: true, ticketOpened: false, latestText: "my room is filthy, I want a refund" }),
    ).toBe(true);
  });

  it("fires on a substantive non-regex answer to the clarifying question", () => {
    expect(shouldForceTicketNow({ adminAsked: true, ticketOpened: false, latestText: "BK-12345, room 204" })).toBe(true);
  });

  it("fires when an attachment on this turn is the actionable signal", () => {
    expect(
      shouldForceTicketNow({ adminAsked: true, ticketOpened: false, latestText: "", hasAttachment: true }),
    ).toBe(true);
  });

  it("does NOT fire on a bare acknowledgement", () => {
    expect(shouldForceTicketNow({ adminAsked: true, ticketOpened: false, latestText: "thanks" })).toBe(false);
    expect(shouldForceTicketNow({ adminAsked: true, ticketOpened: false, latestText: "ok" })).toBe(false);
  });

  it("does NOT fire once a ticket is already open", () => {
    expect(
      shouldForceTicketNow({ adminAsked: true, ticketOpened: true, latestText: "BK-12345, room 204" }),
    ).toBe(false);
  });

  it("does NOT fire when adminAsked is false, however actionable the turn", () => {
    expect(
      shouldForceTicketNow({ adminAsked: false, ticketOpened: false, latestText: "my room is filthy, I want a refund" }),
    ).toBe(false);
  });

  it("does NOT fire on an empty message with no attachment", () => {
    expect(shouldForceTicketNow({ adminAsked: true, ticketOpened: false, latestText: "" })).toBe(false);
  });
});

describe("inferHolidayTypeFromText", () => {
  it("detects a cruise mention", () => {
    expect(inferHolidayTypeFromText("we'd love to go on a cruise to the Caribbean")).toBe("Cruise Package");
    expect(inferHolidayTypeFromText("Customer: cruise please\nAgent: sure thing")).toBe("Cruise Package");
  });

  it("detects a hot tub / lodge mention", () => {
    expect(inferHolidayTypeFromText("looking for a lodge with a hot tub")).toBe("Hot Tub Break");
    expect(inferHolidayTypeFromText("just want a cosy lodge break")).toBe("Hot Tub Break");
  });

  it("returns null for a plain package holiday with no cruise/hot tub signal", () => {
    expect(inferHolidayTypeFromText("2 weeks in Benidorm for a family of 4")).toBeNull();
  });

  it("returns null when nothing matches at all", () => {
    expect(inferHolidayTypeFromText("hi there")).toBeNull();
    expect(inferHolidayTypeFromText("")).toBeNull();
  });

  it("prefers cruise when both cruise and lodge-ish wording appear", () => {
    expect(inferHolidayTypeFromText("a cruise, not a lodge holiday")).toBe("Cruise Package");
  });
});

describe("normalizeTurnSlots", () => {
  it("aliases a cruiseDestination string onto destinations", () => {
    const slots = normalizeTurnSlots({ cruiseDestination: "Caribbean" });
    expect(slots.destinations).toEqual(["Caribbean"]);
  });

  it("aliases a cruiseDestinations array onto destinations", () => {
    const slots = normalizeTurnSlots({ cruiseDestinations: ["Caribbean", "Mediterranean"] });
    expect(slots.destinations).toEqual(["Caribbean", "Mediterranean"]);
  });

  it("merges the alias with an existing destinations array without duplicating", () => {
    const slots = normalizeTurnSlots({ destinations: ["Caribbean"], cruiseDestination: "Caribbean" });
    expect(slots.destinations).toEqual(["Caribbean"]);

    const merged = normalizeTurnSlots({ destinations: ["Caribbean"], cruiseDestination: "Mediterranean" });
    expect(merged.destinations).toEqual(["Caribbean", "Mediterranean"]);
  });

  it("drops keys that aren't in the EnquirySlots interface", () => {
    const slots = normalizeTurnSlots({ destinations: ["Benidorm"], notAField: "junk", another: 123 });
    expect(slots).toEqual({ destinations: ["Benidorm"] });
    expect((slots as Record<string, unknown>).notAField).toBeUndefined();
  });

  it("canonicalizes holidayType casing/shorthand", () => {
    expect(normalizeTurnSlots({ holidayType: "cruise" }).holidayType).toBe("Cruise Package");
    expect(normalizeTurnSlots({ holidayType: "Cruise" }).holidayType).toBe("Cruise Package");
    expect(normalizeTurnSlots({ holidayType: "hot tub" }).holidayType).toBe("Hot Tub Break");
    expect(normalizeTurnSlots({ holidayType: "lodge break" }).holidayType).toBe("Hot Tub Break");
    expect(normalizeTurnSlots({ holidayType: "package holiday" }).holidayType).toBe("Package Holiday");
  });

  it("passes through known fields untouched when no aliasing/canonicalization applies", () => {
    const slots = normalizeTurnSlots({ nights: 7, adults: 2, budget: "1500" });
    expect(slots).toEqual({ nights: 7, adults: 2, budget: "1500" });
  });
});

describe("decideDeterministicRoute (Phase 3.2 route precedence)", () => {
  it("routes to admin when an actionable signal breaks out of an in-flight enquiry", () => {
    expect(decideDeterministicRoute({ enquiryInFlight: true, actionable: true, adminAsk: true })).toBe("admin");
  });

  it("routes to admin when an attachment breaks out of an in-flight enquiry, even if not textually actionable", () => {
    expect(
      decideDeterministicRoute({ enquiryInFlight: true, hasAttachments: true, actionable: false, adminAsk: false }),
    ).toBe("admin");
  });

  it("stays sales when mid-enquiry and the turn is merely admin-ish but not actionable", () => {
    expect(decideDeterministicRoute({ enquiryInFlight: true, actionable: false, adminAsk: true })).toBe("sales");
  });

  it("stays sales when mid-enquiry with no admin signal at all", () => {
    expect(decideDeterministicRoute({ enquiryInFlight: true, actionable: false, adminAsk: false })).toBe("sales");
  });

  it("routes to admin (not mid-enquiry) on a deterministic admin ask", () => {
    expect(decideDeterministicRoute({ enquiryInFlight: false, actionable: false, adminAsk: true })).toBe("admin");
  });

  it("routes to admin (not mid-enquiry) on an attachment alone", () => {
    expect(
      decideDeterministicRoute({ enquiryInFlight: false, hasAttachments: true, actionable: false, adminAsk: false }),
    ).toBe("admin");
  });

  it("falls back to the LLM classifier when nothing deterministic applies", () => {
    expect(decideDeterministicRoute({ enquiryInFlight: false, actionable: false, adminAsk: false })).toBe("classify");
  });
});

describe("MAX_ENQUIRY_ASKS", () => {
  it("is exported as the ask-cap", () => {
    expect(MAX_ENQUIRY_ASKS).toBe(5);
  });
});

describe("missingCoreFieldsFor (required-core gate)", () => {
  it("returns the full package core list when nothing is filled", () => {
    const slots: EnquirySlots = {};
    expect(missingCoreFieldsFor(slots)).toEqual([
      "destination",
      "travel dates",
      "number of nights",
      "number of passengers",
      "budget",
    ]);
  });

  it("returns [] once every package core field is filled", () => {
    const slots: EnquirySlots = {
      destinations: ["Benidorm"],
      travelDate: "2026-09-01",
      nights: 7,
      adults: 2,
      budget: "1500",
    };
    expect(missingCoreFieldsFor(slots)).toEqual([]);
  });

  it("reports only the still-missing package core fields", () => {
    const slots: EnquirySlots = { destinations: ["Benidorm"], nights: 7 };
    expect(missingCoreFieldsFor(slots)).toEqual(["travel dates", "number of passengers", "budget"]);
  });

  it("uses cruise labels for a cruise holidayType", () => {
    const slots: EnquirySlots = { holidayType: "Cruise Package" };
    expect(missingCoreFieldsFor(slots)).toEqual([
      "cruise destination",
      "travel dates",
      "number of nights",
      "number of passengers",
      "budget",
    ]);
  });

  it("uses guests (not adults) for a hot tub holidayType", () => {
    const slots: EnquirySlots = { holidayType: "Hot Tub Break", adults: 2 };
    // adults being set must NOT satisfy the hot-tub core party-size check —
    // only `guests` counts.
    expect(missingCoreFieldsFor(slots)).toEqual(["destination", "travel dates", "number of nights", "number of guests", "budget"]);

    const filled: EnquirySlots = {
      holidayType: "Hot Tub Break",
      destinations: ["Cotswolds"],
      travelDate: "2026-09-01",
      nights: 3,
      guests: 4,
      budget: "800",
    };
    expect(missingCoreFieldsFor(filled)).toEqual([]);
  });

  it("treats flexibility (vague dates) as satisfying hasDates, same as travelDate", () => {
    const slots: EnquirySlots = { flexibility: "sometime in summer" };
    expect(missingCoreFieldsFor(slots)).not.toContain("travel dates");
  });
});

describe("buildRulesBlock", () => {
  const rules: BotRule[] = [
    { text: "Always mention our price-match guarantee.", audience: "general" },
    { text: "Ask for the party size before anything else.", audience: "sales" },
    { text: "Escalate VIP clients immediately.", audience: "admin" },
    { text: "This one is disabled.", audience: "general", isActive: false },
  ];

  it("header text scopes precedence to tone/pacing/phrasing, not data-integrity/flow", () => {
    const block = buildRulesBlock(rules, "sales");
    expect(block).toContain("precedence");
    expect(block).toContain("tone");
    expect(block).toMatch(/pacing/i);
    expect(block).toMatch(/phrasing/i);
    expect(block).toMatch(/never invent/i);
    expect(block).toMatch(/identity|verification/i);
  });

  it("header explicitly resolves pacing conflicts in the agency rule's favour, while keeping data-integrity/flow rules dominant", () => {
    const block = buildRulesBlock(rules, "sales");
    // Explicit conflict-resolution: e.g. how many questions per message — agency rule WINS.
    expect(block).toMatch(/how many questions/i);
    expect(block).toMatch(/AGENCY RULE\s+WINS/);
    // But data-integrity/flow rules still always win over any agency rule.
    expect(block).toMatch(/never override data-integrity or flow rules/i);
    expect(block).toMatch(/always win over any agency rule/i);
  });

  it("filters by audience — sales sees general+sales, not admin", () => {
    const block = buildRulesBlock(rules, "sales");
    expect(block).toContain("Always mention our price-match guarantee.");
    expect(block).toContain("Ask for the party size before anything else.");
    expect(block).not.toContain("Escalate VIP clients immediately.");
  });

  it("filters by audience — internal only sees general-audience rules", () => {
    const block = buildRulesBlock(rules, "internal");
    expect(block).toContain("Always mention our price-match guarantee.");
    expect(block).not.toContain("Ask for the party size before anything else.");
    expect(block).not.toContain("Escalate VIP clients immediately.");
  });

  it("drops isActive: false rules", () => {
    const block = buildRulesBlock(rules, "sales");
    expect(block).not.toContain("This one is disabled.");
  });

  it("returns null when nothing is left after filtering", () => {
    expect(buildRulesBlock(parseBotRules([{ text: "Admin only", audience: "admin" }]), "sales")).toBeNull();
    expect(buildRulesBlock([], "sales")).toBeNull();
  });
});
