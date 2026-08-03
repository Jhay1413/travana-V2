import { describe, it, expect } from "vitest";
import {
  audienceAllows,
  buildRulesBlock,
  buildSystemPrompt,
  decideDeterministicRoute,
  effectiveAttachmentKind,
  IMAGE_TRIAGE_MAX_BYTES,
  IMAGE_TRIAGE_MAX_IMAGES,
  inferHolidayTypeFromText,
  looksLikeDocumentMention,
  isAcknowledgement,
  looksLikeActionableAdmin,
  looksLikeAdminAsk,
  MAX_ENQUIRY_ASKS,
  missingCoreFieldsFor,
  normalizeTurnSlots,
  parseBotRules,
  retrievedAudienceAllows,
  selectImagesForTriage,
  shouldCreateEnquiryNow,
  shouldForceTicketNow,
  type BotRule,
  type ImageAttachmentLike,
} from "./ai-conversation.brain";
import type { EnquirySlots, RetrievedContext } from "./ai-conversation.types";
import type { NeonClient, OrgBotConfig, OrgKnowledgeBase } from "@shared/schema";

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

  // ── Attachment-kind awareness (vision triage) ─────────────────────────────
  it("routes a holiday_info image (deal/advert screenshot) to SALES, not admin", () => {
    expect(
      decideDeterministicRoute({ enquiryInFlight: false, hasAttachments: true, attachmentKind: "holiday_info", actionable: false, adminAsk: false }),
    ).toBe("sales");
  });

  it("a holiday_info image mid-enquiry stays sales (never breaks out to admin)", () => {
    expect(
      decideDeterministicRoute({ enquiryInFlight: true, hasAttachments: true, attachmentKind: "holiday_info", actionable: false, adminAsk: false }),
    ).toBe("sales");
  });

  it("a document image still forces admin, in and out of an enquiry", () => {
    expect(
      decideDeterministicRoute({ enquiryInFlight: false, hasAttachments: true, attachmentKind: "document", actionable: false, adminAsk: false }),
    ).toBe("admin");
    expect(
      decideDeterministicRoute({ enquiryInFlight: true, hasAttachments: true, attachmentKind: "document", actionable: false, adminAsk: false }),
    ).toBe("admin");
  });

  it("an 'other' image gives no routing signal — the text decides", () => {
    expect(
      decideDeterministicRoute({ enquiryInFlight: false, hasAttachments: true, attachmentKind: "other", actionable: false, adminAsk: false }),
    ).toBe("classify");
    expect(
      decideDeterministicRoute({ enquiryInFlight: false, hasAttachments: true, attachmentKind: "other", actionable: false, adminAsk: true }),
    ).toBe("admin");
  });

  it("an attachment with NO triage (kind null/omitted) keeps the fail-safe document default", () => {
    expect(
      decideDeterministicRoute({ enquiryInFlight: false, hasAttachments: true, attachmentKind: null, actionable: false, adminAsk: false }),
    ).toBe("admin");
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
    expect(missingCoreFieldsFor(slots)).toEqual(["travel dates", "number of nights", "number of guests", "budget"]);

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

  it("hot tub core does NOT require destination — customers shop by radius/area, not a named destination", () => {
    const slots: EnquirySlots = {
      holidayType: "Hot Tub Break",
      travelDate: "2026-08-22",
      nights: 7,
      guests: 4,
      budget: "800",
      notes: "within an hour's drive of Newcastle",
    };
    expect(missingCoreFieldsFor(slots)).toEqual([]);
  });

  it("package and cruise core still require destination", () => {
    const packageSlots: EnquirySlots = { travelDate: "2026-08-22", nights: 7, adults: 2, budget: "800" };
    expect(missingCoreFieldsFor(packageSlots)).toContain("destination");

    const cruiseSlots: EnquirySlots = { holidayType: "Cruise Package", travelDate: "2026-08-22", nights: 7, adults: 2, budget: "800" };
    expect(missingCoreFieldsFor(cruiseSlots)).toContain("cruise destination");
  });

  it("treats flexibility (vague dates) as satisfying hasDates, same as travelDate", () => {
    const slots: EnquirySlots = { flexibility: "sometime in summer" };
    expect(missingCoreFieldsFor(slots)).not.toContain("travel dates");
  });
});

describe("shouldCreateEnquiryNow (create-immediately gate — no more grouped-ask round)", () => {
  it("is true once the required core fields are complete, even under the ask-cap", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 0, askCount: 1 })).toBe(true);
  });

  it("is false while core fields are still missing and the ask-cap hasn't been hit", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 2, askCount: 1 })).toBe(false);
  });

  it("is true once the ask-cap is reached, even with core fields still missing", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 3, askCount: MAX_ENQUIRY_ASKS })).toBe(true);
    expect(shouldCreateEnquiryNow({ coreMissingCount: 3, askCount: MAX_ENQUIRY_ASKS + 1 })).toBe(true);
  });

  it("is true when the model declares completion, even with core slots empty and asks under the cap (declined fields leave slots empty)", () => {
    // e.g. "any date is fine, whatever's cheapest" — travelDate stays empty per
    // the DATES rule, the model stops asking per the stop rule, and without
    // this signal the enquiry would never be created.
    expect(shouldCreateEnquiryNow({ coreMissingCount: 1, askCount: 1, modelSaysComplete: true })).toBe(true);
  });

  it("ignores a false/absent model completion flag (unchanged gate behavior)", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 1, askCount: 1, modelSaysComplete: false })).toBe(false);
  });

  it("is true when the conversation already sent the legacy grouped ask on a prior turn, regardless of core/ask-cap", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 5, askCount: 0, groupedAskSentLegacy: true })).toBe(true);
  });

  it("is false with core missing, under the ask-cap, and no legacy grouped ask sent", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 1, askCount: 0, groupedAskSentLegacy: false })).toBe(false);
  });
});

describe("retrievedAudienceAllows", () => {
  it("fails CLOSED — null/undefined/missing audience is never visible to any bot, unlike audienceAllows", () => {
    expect(retrievedAudienceAllows(null, "sales")).toBe(false);
    expect(retrievedAudienceAllows(undefined, "sales")).toBe(false);
    expect(retrievedAudienceAllows(null, "admin")).toBe(false);
    expect(retrievedAudienceAllows(undefined, "internal")).toBe(false);

    // The plain (fail-OPEN) variant defaults the same inputs to "general" —
    // confirms the two intentionally diverge only on missing audience.
    expect(audienceAllows(null, "sales")).toBe(true);
    expect(audienceAllows(undefined, "sales")).toBe(true);
  });

  it("behaves exactly like audienceAllows once audience is present", () => {
    for (const bot of ["sales", "admin", "internal"] as const) {
      for (const audience of ["general", "sales", "admin"]) {
        expect(retrievedAudienceAllows(audience, bot)).toBe(audienceAllows(audience, bot));
      }
    }
  });
});

describe("buildSystemPrompt (prompt-caching prefix/tail ordering)", () => {
  it("renders the dynamic client line and retrieved-context blocks AFTER the static agency rules block", () => {
    const botConfig = {
      orgId: "org-1",
      name: "Test Bot",
      avatarUrl: null,
      persona: null,
      preferredResponse: null,
      greeting: null,
      signOff: null,
      language: "en-GB",
      handoffInstructions: null,
      rules: [{ text: "AGENCY-MARKER-RULE", audience: "general" }],
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as OrgBotConfig;

    const client = {
      title: null,
      firstName: "ZZZCLIENTNAME",
      surename: "Test",
    } as unknown as NeonClient;

    const kb: OrgKnowledgeBase[] = [];

    const retrieved: RetrievedContext = {
      kb: [{ sourceId: "kb-1", content: "RETRIEVED-KB-MARKER", metadata: { audience: "general" }, distance: 0 }],
      quotes: [{ sourceId: "quote-1", content: "RETRIEVED-QUOTE-MARKER", metadata: null, distance: 0 }],
    };

    const prompt = buildSystemPrompt(botConfig, kb, client, true, retrieved);

    const rulesIdx = prompt.indexOf("AGENCY-MARKER-RULE");
    const clientIdx = prompt.indexOf("ZZZCLIENTNAME");
    const retrievedKbIdx = prompt.indexOf("RETRIEVED-KB-MARKER");
    const retrievedQuoteIdx = prompt.indexOf("RETRIEVED-QUOTE-MARKER");

    expect(rulesIdx).toBeGreaterThan(-1);
    expect(clientIdx).toBeGreaterThan(-1);
    expect(retrievedKbIdx).toBeGreaterThan(-1);
    expect(retrievedQuoteIdx).toBeGreaterThan(-1);

    expect(clientIdx).toBeGreaterThan(rulesIdx);
    expect(retrievedKbIdx).toBeGreaterThan(rulesIdx);
    expect(retrievedQuoteIdx).toBeGreaterThan(rulesIdx);
  });

  it("does NOT fold retrieved-KB matches into the static company-info block", () => {
    const kb: OrgKnowledgeBase[] = [
      {
        id: "kb-1",
        orgId: "org-1",
        title: "Static Fact",
        content: "STATIC-KB-CONTENT",
        category: null,
        audience: "general",
        isActive: true,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as OrgKnowledgeBase,
    ];
    const retrieved: RetrievedContext = {
      kb: [{ sourceId: "kb-2", content: "RETRIEVED-ONLY-MARKER", metadata: { audience: "general" }, distance: 0 }],
      quotes: [],
    };

    const prompt = buildSystemPrompt(null, kb, null, true, retrieved);

    expect(prompt).toContain("Company information (use it to answer accurately):\n- Static Fact: STATIC-KB-CONTENT");
    expect(prompt).toContain("Possibly relevant knowledge for THIS message:\n- RETRIEVED-ONLY-MARKER");
  });

  it("excludes retrieved-KB matches with no audience in their metadata (fail-closed, not defaulted to general)", () => {
    const retrieved: RetrievedContext = {
      kb: [
        // No `audience` key at all — e.g. a stale/pre-migration embedding row.
        { sourceId: "kb-no-audience", content: "SHOULD-NOT-APPEAR-MARKER", metadata: {}, distance: 0 },
        { sourceId: "kb-null-metadata", content: "ALSO-SHOULD-NOT-APPEAR-MARKER", metadata: null, distance: 0 },
        { sourceId: "kb-general", content: "SHOULD-APPEAR-MARKER", metadata: { audience: "general" }, distance: 0 },
        { sourceId: "kb-admin", content: "ADMIN-SHOULD-NOT-APPEAR-MARKER", metadata: { audience: "admin" }, distance: 0 },
      ],
      quotes: [],
    };

    const prompt = buildSystemPrompt(null, [], null, true, retrieved);

    expect(prompt).not.toContain("SHOULD-NOT-APPEAR-MARKER");
    expect(prompt).not.toContain("ALSO-SHOULD-NOT-APPEAR-MARKER");
    expect(prompt).not.toContain("ADMIN-SHOULD-NOT-APPEAR-MARKER");
    expect(prompt).toContain("SHOULD-APPEAR-MARKER");
  });

  it("fences the transcript with an injection guard that sits in the static prefix (before the dynamic client/retrieved-context tail)", () => {
    const client = { title: null, firstName: "ZZZCLIENTNAME", surename: "Test" } as unknown as NeonClient;
    const prompt = buildSystemPrompt(null, [], client, true);

    const guardIdx = prompt.indexOf("<transcript>");
    const clientIdx = prompt.indexOf("ZZZCLIENTNAME");

    expect(guardIdx).toBeGreaterThan(-1);
    expect(prompt).toContain("untrusted customer input");
    // The guard must be part of the byte-stable STATIC prefix, i.e. ahead of
    // the dynamic client line (which varies per customer/turn).
    expect(guardIdx).toBeLessThan(clientIdx);
  });

  it("bans proactive asks for anything outside the core fields (incl. non-slot extras like luggage/transfers) and tells the model to stop once cores are answered", () => {
    const prompt = buildSystemPrompt(null, [], null, true);

    // Categorical ban — not just the enumerated nice-to-have fields.
    expect(prompt).toContain("Do NOT proactively ask about ANYTHING outside the core fields");
    expect(prompt).toContain("luggage/baggage, transfers, insurance");
    // The old open-ended clause that licensed follow-up rounds must be gone.
    expect(prompt).not.toContain("pick them up naturally over the next few replies");
    // Explicit conversational stop once every core field is answered.
    expect(prompt).toContain("ONCE EVERY CORE FIELD IS ANSWERED");
    expect(prompt).toContain("STOP asking questions entirely");
    // No confirmation/double-check loops, no unsolicited alternatives.
    expect(prompt).toContain("NEVER ask the customer to confirm, verify, or double-check");
    expect(prompt).toContain("never offer alternative hotels, resorts, or dates");
    // budgetType must not be interrogated when the customer didn't state it.
    expect(prompt).toContain('leave `budgetType` empty and do NOT ask');
    // No "Just to check" filler openers.
    expect(prompt).toContain('Never open a question with filler like "Just to check"');
  });

  it("reasserts the core-fields-only scope AFTER the agency rules block so a configured rule cannot re-license off-list asks", () => {
    const botConfig = {
      rules: [{ text: "always ask 2 or 3 questions that we need from the enquiry form", audience: "sales", isActive: true }],
    } as unknown as OrgBotConfig;
    const prompt = buildSystemPrompt(botConfig, [], null, true);

    const ruleIdx = prompt.indexOf("questions that we need from the enquiry form");
    const scopeIdx = prompt.indexOf("AGENCY RULE SCOPE");

    expect(ruleIdx).toBeGreaterThan(-1);
    expect(scopeIdx).toBeGreaterThan(ruleIdx);
    expect(prompt).toContain("They can NEVER expand WHICH details you may proactively ask about");

    // Without agency rules, the reassertion is omitted (keeps the prompt lean).
    expect(buildSystemPrompt(null, [], null, true)).not.toContain("AGENCY RULE SCOPE");
  });

  it("includes a complete few-shot example of the JSON output contract, with empty fields shown", () => {
    const prompt = buildSystemPrompt(null, [], null, true);

    expect(prompt).toContain("EXAMPLE —");
    expect(prompt).toContain('"hand_off": false');
    expect(prompt).toContain('"intent": "enquiry"');
    expect(prompt).toContain('"complete": false');
    expect(prompt).toContain('"destinations": ["Tenerife"]');
    // Demonstrates the shape includes empty/null fields, not just filled ones.
    expect(prompt).toMatch(/"travelDate":\s*""/);
    expect(prompt).toMatch(/"nights":\s*null/);
    expect(prompt).toContain('"beneficiary": {"onBehalf": false');
  });

  it("dedupes the 'do not assume the customer wants to book' rule to one authoritative statement (repeats become short references, not restatements)", () => {
    const p = buildSystemPrompt(null, [], null, true);
    // The old restated bullet used this exact ALL-CAPS phrasing — it should no
    // longer appear verbatim now that it's consolidated into the single
    // MOST IMPORTANT RULE statement near the top of the static prefix.
    expect(p).not.toContain("DO NOT ASSUME THE CUSTOMER WANTS TO BOOK.");
    expect(p).toContain("MOST IMPORTANT RULE: NEVER assume the customer wants to book a holiday.");
  });

  it("dedupes the 'don't say the team will call' rule to one authoritative statement", () => {
    const p = buildSystemPrompt(null, [], null, true);
    // The old second restatement used this exact phrasing — should be gone.
    expect(p).not.toContain("or that the team/an advisor will call or be in touch");
    // The single authoritative statement remains.
    expect(p).toContain(
      "Do NOT offer to arrange a call, a callback, or say a colleague/advisor/the team will be in touch while you are still gathering enquiry details",
    );
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

describe("selectImagesForTriage (vision guardrails)", () => {
  const att = (overrides: Partial<ImageAttachmentLike> = {}): ImageAttachmentLike => ({
    buffer: Buffer.from("x"),
    filename: "photo.jpg",
    contentType: "image/jpeg",
    size: 1024,
    ...overrides,
  });

  it("keeps image/* attachments only — PDFs, videos, and unknown types are dropped", () => {
    const kept = selectImagesForTriage([
      att({ filename: "passport.jpg", contentType: "image/jpeg" }),
      att({ filename: "invoice.pdf", contentType: "application/pdf" }),
      att({ filename: "clip.mp4", contentType: "video/mp4" }),
      att({ filename: "scan.png", contentType: "image/png" }),
      att({ filename: "mystery.bin", contentType: "" }),
    ]);
    expect(kept.map((a) => a.filename)).toEqual(["passport.jpg", "scan.png"]);
  });

  it("is case-insensitive on the content type", () => {
    expect(selectImagesForTriage([att({ contentType: "IMAGE/JPEG" })])).toHaveLength(1);
  });

  it("drops oversized and empty files", () => {
    const kept = selectImagesForTriage([
      att({ filename: "huge.jpg", size: IMAGE_TRIAGE_MAX_BYTES + 1 }),
      att({ filename: "empty.jpg", size: 0 }),
      att({ filename: "at-cap.jpg", size: IMAGE_TRIAGE_MAX_BYTES }),
    ]);
    expect(kept.map((a) => a.filename)).toEqual(["at-cap.jpg"]);
  });

  it("caps at IMAGE_TRIAGE_MAX_IMAGES, preserving arrival order", () => {
    const many = Array.from({ length: IMAGE_TRIAGE_MAX_IMAGES + 2 }, (_, i) => att({ filename: `img-${i}.jpg` }));
    const kept = selectImagesForTriage(many);
    expect(kept).toHaveLength(IMAGE_TRIAGE_MAX_IMAGES);
    expect(kept.map((a) => a.filename)).toEqual(many.slice(0, IMAGE_TRIAGE_MAX_IMAGES).map((a) => a.filename));
  });

  it("returns empty for no attachments (caller then behaves exactly as before)", () => {
    expect(selectImagesForTriage([])).toEqual([]);
  });
});

describe("effectiveAttachmentKind (customer's words vs vision verdict)", () => {
  it("null triage (vision failed) → fail-safe document", () => {
    expect(effectiveAttachmentKind(null, "hi")).toBe("document");
    expect(effectiveAttachmentKind(undefined, "hi")).toBe("document");
  });

  it("triage 'other' + the customer naming a document → document (their words win)", () => {
    expect(effectiveAttachmentKind("other", "Hi heres my passport")).toBe("document");
    expect(effectiveAttachmentKind("other", "sending my driving licence over")).toBe("document");
    expect(effectiveAttachmentKind("other", "insurance attached")).toBe("document");
    expect(effectiveAttachmentKind("other", "here's the booking confirmation")).toBe("document");
  });

  it("triage 'other' with no document mention stays other", () => {
    expect(effectiveAttachmentKind("other", "look at this lovely beach!")).toBe("other");
    expect(effectiveAttachmentKind("other", "")).toBe("other");
  });

  it("a confident document/holiday_info verdict stands regardless of text", () => {
    expect(effectiveAttachmentKind("document", "look at this")).toBe("document");
    expect(effectiveAttachmentKind("holiday_info", "can you do this deal? passport ready when needed")).toBe("holiday_info");
  });

  it("looksLikeDocumentMention: matches document words, not ordinary chat", () => {
    expect(looksLikeDocumentMention("heres my passport")).toBe(true);
    expect(looksLikeDocumentMention("my ID")).toBe(true);
    expect(looksLikeDocumentMention("the paperwork you asked for")).toBe(true);
    expect(looksLikeDocumentMention("we want a week in Tenerife")).toBe(false);
    expect(looksLikeDocumentMention("I'd love that")).toBe(false);
  });
});
