// Executable conformance checks for docs/ai-auto-reply-test-conversations.md.
//
// That document is the acceptance checklist for the auto-reply worker, and
// roughly half its assertions rest on deterministic code — regexes, gates,
// route precedence — rather than on model behaviour. Those halves are pinned
// here, using the DOC'S OWN customer strings, so the checklist and the
// implementation cannot drift apart silently. (They already had: five of its
// claims were false when this file was first written.)
//
// Scenario ids below match the headings in that document. Anything depending
// on a live model — tone, slot extraction, whether the reply obeys the prompt
// — is deliberately NOT here; it cannot be asserted without calling OpenAI.
import { describe, it, expect } from "vitest";
import {
  cleanTravellerName,
  decideDeterministicRoute,
  extractTravellerRelationship,
  effectiveAttachmentKind,
  inferHolidayTypeFromText,
  isAcknowledgement,
  isOpenAvailability,
  isUnreadableMediaType,
  looksLikeActionableAdmin,
  looksLikeAdminAsk,
  prefersMessagingOverCall,
  saysToday,
  shouldCreateEnquiryNow,
  MAX_ENQUIRY_ASKS,
} from "./ai-conversation.brain";
import { extractPhoneNumber } from "../sendseven-webhook/identity.service";


describe("A3 — declines everything, the ask-cap ends the interrogation", () => {
  it("creates the enquiry once the cap is hit, core fields still missing", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 3, askCount: MAX_ENQUIRY_ASKS })).toBe(true);
  });

  it("also opens on the model's own complete flag, for explicitly declined fields", () => {
    expect(shouldCreateEnquiryNow({ coreMissingCount: 3, askCount: 1, modelSaysComplete: true })).toBe(true);
  });
});

describe("A5 — messaging-only customer, asked once then accepted", () => {
  it("detects the first refusal", () => {
    expect(prefersMessagingOverCall("id rather not have a call, can you just message me the prices")).toBe(true);
  });

  // Regression: this matched the singular only, so the bare plural fell through
  // as NOT a refusal and the flow confirmed a callback to someone who had just
  // declined one twice.
  it("detects the second refusal, singular or plural", () => {
    expect(prefersMessagingOverCall("messages please")).toBe(true);
    expect(prefersMessagingOverCall("message please")).toBe(true);
    expect(prefersMessagingOverCall("just text me")).toBe(true);
    expect(prefersMessagingOverCall("texts are fine")).toBe(true);
  });

  // Live failure: "just keep it all here" was NOT matched — the word "all"
  // broke `keep it here`. The flow then treated a refusal as a callback answer.
  it("detects the keep-it-here family, however they phrase it", () => {
    for (const t of [
      "just keep it all here",
      "just keep it here",
      "keep it on here",
      "keep everything here",
      "lets keep it all on messages",
      "keep this here please",
      "here is fine",
      "messages are fine",
    ]) {
      expect(prefersMessagingOverCall(t)).toBe(true);
    }
  });

  it("does not read an explicit request for a call as a refusal", () => {
    expect(prefersMessagingOverCall("call me after 4")).toBe(false);
    expect(prefersMessagingOverCall("tomorrow after 3 would be good")).toBe(false);
    expect(prefersMessagingOverCall("any time after 4 today")).toBe(false);
  });
});

describe("A6 — a second enquiry in one thread starts clean", () => {
  it("re-types the holiday from the customer's own words", () => {
    expect(inferHolidayTypeFromText("Customer: do you do cruises? thinking norwegian fjords")).toBe("Cruise Package");
  });

  it("ignores the same word in OUR half of the transcript", () => {
    expect(inferHolidayTypeFromText("Agent: we don't do cruise-only bookings\nCustomer: benidorm please")).toBeNull();
  });
});

describe("D6 / I6 — deterministic admin phrasing", () => {
  it("D6: 'status of my booking' routes admin", () => {
    expect(looksLikeAdminAsk("whats the status of my booking to tenerife")).toBe(true);
  });

  it("D6: the vague follow-up is not admin, so it can never become a lookup key", () => {
    expect(looksLikeAdminAsk("its under the tenerife one in august")).toBe(false);
  });

  it("I6: mixed intent resolves to admin via the record noun", () => {
    expect(
      looksLikeAdminAsk("where are my tickets for majorca, and also what have you got for new year in lapland?"),
    ).toBe(true);
  });
});

describe("F2 — chasing an update wakes a handed-off thread", () => {
  it("matches the British way of chasing, which names no record", () => {
    expect(looksLikeAdminAsk("hi did you manage to get those benidorm prices? havent heard back")).toBe(true);
    expect(looksLikeAdminAsk("any joy?")).toBe(true);
    expect(looksLikeAdminAsk("were you able to sort a price?")).toBe(true);
  });
});

describe("F3 — stale thread, pure chatter must stay silent", () => {
  // The resume gate short-circuits on this BEFORE calling the router, so the
  // silence is deterministic rather than a model verdict.
  it("recognises a bare acknowledgement", () => {
    expect(isAcknowledgement("ok")).toBe(true);
    expect(isAcknowledgement("thanks")).toBe(true);
  });

  it("does not treat a substantive message as an acknowledgement", () => {
    expect(isAcknowledgement("are you still doing the fuerteventura deals?")).toBe(false);
  });
});

describe("G — identity from the transcript", () => {
  it("G1: finds a real number the customer typed", () => {
    expect(extractPhoneNumber("07700 900456")).toBe("07700 900456");
  });

  it("G4: a booking reference is not a phone number", () => {
    expect(extractPhoneNumber("the ref is 12345678901")).toBeNull();
  });
});

describe("I4 — a callback time that is in the past or unusable", () => {
  const text = "yesterday afternoon would have been ideal lol";

  it("is not read as today", () => expect(saysToday(text)).toBe(false));
  it("is not read as open availability", () => expect(isOpenAvailability(text)).toBe(false));
  it("is not read as a refusal of the call", () => expect(prefersMessagingOverCall(text)).toBe(false));
});

describe("I5 — vague but open availability resolves to a slot", () => {
  it("accepts the everyday phrasings, not just 'all day'", () => {
    expect(isOpenAvailability("im about most of the day tomorrow")).toBe(true);
    expect(isOpenAvailability("im about all day tomorrow")).toBe(true);
    expect(isOpenAvailability("anytime suits")).toBe(true);
    expect(isOpenAvailability("whenever")).toBe(true);
  });
});

describe("H — attachment routing", () => {
  it("H1: an uncaptioned passport photo is a document, routed admin", () => {
    expect(effectiveAttachmentKind("document", "")).toBe("document");
    expect(
      decideDeterministicRoute({
        enquiryInFlight: false,
        hasAttachments: true,
        attachmentKind: "document",
        actionable: false,
        adminAsk: false,
      }),
    ).toBe("admin");
  });

  it("H2: a screenshot of our own post is holiday_info, routed sales", () => {
    expect(effectiveAttachmentKind("holiday_info", "is this still available for 4 of us?")).toBe("holiday_info");
    expect(
      decideDeterministicRoute({
        enquiryInFlight: false,
        hasAttachments: true,
        attachmentKind: "holiday_info",
        actionable: false,
        adminAsk: false,
      }),
    ).toBe("sales");
  });

  it("H3: audio and video are unreadable, so they are never ticketed as documents", () => {
    expect(isUnreadableMediaType("audio/ogg")).toBe(true);
    expect(isUnreadableMediaType("video/mp4")).toBe(true);
    // Images and PDFs stay on the normal path — the fail-safe ticket is right
    // for a PDF, which really is a document even though vision cannot read it.
    expect(isUnreadableMediaType("image/jpeg")).toBe(false);
    expect(isUnreadableMediaType("application/pdf")).toBe(false);
    expect(isUnreadableMediaType(null)).toBe(false);
  });
});

describe("I7 — abuse and escalation reach a person, not a sales pitch", () => {
  it("recognises escalation that names no complaint word and no record", () => {
    expect(
      looksLikeActionableAdmin(
        "this is an absolute joke, third time ive asked, sort it out or im going to trading standards",
      ),
    ).toBe(true);
    expect(looksLikeActionableAdmin("im absolutely fuming about this")).toBe(true);
    expect(looksLikeActionableAdmin("I'll be speaking to my solicitor")).toBe(true);
    expect(looksLikeActionableAdmin("I want to take this further")).toBe(true);
  });

  it("does not fire on an ordinary sales enquiry", () => {
    expect(looksLikeActionableAdmin("I'd like to book a holiday to Benidorm")).toBe(false);
    expect(looksLikeActionableAdmin("2 adults 10 nights mid october from Manchester")).toBe(false);
    expect(looksLikeActionableAdmin("somewhere hot in the school holidays, not fussy")).toBe(false);
  });
});

// A2 in the doc — "Onboarding refused, then given late". A terse reply while we
// are still waiting for a name and number used to fall to the LLM classifier
// and land on the GENERAL route, whose prompt tells the bot NOT to ask for a
// name or phone. Observed live: "no i cant" → the bot invented a security
// justification and closed the conversation down.
describe("A2 — onboarding survives a terse or hostile reply", () => {
  const onboarding = { enquiryInFlight: false, onboardingInFlight: true, actionable: false, adminAsk: false };

  it("keeps a flat refusal on the onboarding flow", () => {
    expect(decideDeterministicRoute(onboarding)).toBe("sales");
  });

  it("does not depend on the classifier at all while onboarding is in flight", () => {
    // "classify" would hand the verdict to the LLM, which is how it went general.
    expect(decideDeterministicRoute(onboarding)).not.toBe("classify");
  });

  it("still lets a genuine admin question through mid-onboarding (D6)", () => {
    expect(decideDeterministicRoute({ ...onboarding, adminAsk: true })).toBe("admin");
  });

  it("still lets a document submission through mid-onboarding", () => {
    expect(
      decideDeterministicRoute({ ...onboarding, hasAttachments: true, attachmentKind: "document" }),
    ).toBe("admin");
  });

  it("changes nothing once the contact is identified", () => {
    expect(decideDeterministicRoute({ ...onboarding, onboardingInFlight: false })).toBe("classify");
  });
});

// A4 in the doc — a third-party enquiry. Observed live: "my mam wants to go to
// Lanzarote in feb" was answered with "send me your friend's full name and
// phone number". Two faults: the ask hard-coded "friend", and the generic-name
// guard had no family terms, so "my mam" would have become a CRM client called
// literally "My Mam".
describe("A4 — the traveller is referred to as the customer referred to them", () => {
  it("picks up the relationship the customer used", () => {
    expect(extractTravellerRelationship("my mam wants to go to Lanzarote in feb")).toBe("mam");
    expect(extractTravellerRelationship("I'm enquiring for my mum Susan")).toBe("mum");
    expect(extractTravellerRelationship("a trip for my wife")).toBe("wife");
    expect(extractTravellerRelationship("our Sheila fancies Benidorm")).toBeUndefined();
    expect(extractTravellerRelationship("my friend saw your Benidorm post")).toBe("friend");
  });

  it("stays undefined when they never said, so the wording is neutral not guessed", () => {
    expect(extractTravellerRelationship("can you sort a quote for someone else")).toBeUndefined();
    expect(extractTravellerRelationship("")).toBeUndefined();
  });
});

describe("A4 — a relationship word is never stored as a traveller's name", () => {
  it("rejects family terms, with or without a determiner", () => {
    for (const v of ["my mam", "mam", "our mam", "my mum", "mother", "my wife", "my husband", "my nan", "my brother", "my daughter"]) {
      expect(cleanTravellerName(v)).toBeUndefined();
    }
  });

  it("still rejects the non-family generics it always did", () => {
    expect(cleanTravellerName("my friend")).toBeUndefined();
    expect(cleanTravellerName("someone")).toBeUndefined();
  });

  it("never touches a real name that merely contains one of those words", () => {
    expect(cleanTravellerName("Sheila Hall")).toBe("Sheila Hall");
    expect(cleanTravellerName("Nan Smith")).toBe("Nan Smith");
    expect(cleanTravellerName("Frank Partner")).toBe("Frank Partner");
  });
});
