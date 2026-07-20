import { UTILITY_MODEL } from "../../utils/ai-model";
import { getOpenAI, logAiUsage, looksLikeAdminAsk } from "./ai-conversation.brain";

// Upper-level ROUTER bot: a small, focused classifier that runs BEFORE any of
// the specialized bots and decides which one handles the turn:
//   - "sales" → the enquiry bot (new holiday leads / enquiry slot-filling)
//   - "admin" → the admin bot (an EXISTING customer asking about their OWN
//     quotes / enquiries / bookings / tickets / documents)
//   - "general" → no bot with an agenda — a plain conversational reply for
//     greetings/small talk/general questions, with no enquiry slot-filling and
//     no onboarding demand for name+phone
//
// Kept deliberately SEPARATE from the enquiry bot's large prompt: that prompt
// is enquiry-heavy and classifies routing unreliably, and we don't want to keep
// bolting onto it. Routing lives here in one tiny prompt so the enquiry bot
// stays untouched. Deterministic guards run first (zero-cost, high-precision);
// only genuinely ambiguous messages reach the LLM.

export type ConversationRoute = "sales" | "admin" | "general";

const ROUTER_SYSTEM_PROMPT = [
  "You are a message router for a UK travel agency's customer chat. Read the customer's LATEST message (using the conversation for context) and classify it into exactly one route:",
  '- "sales": the customer wants a NEW holiday, trip, quote or deal, is exploring destinations / dates / prices / availability / options for a trip they have NOT yet booked, or is answering holiday-enquiry questions (destination, travel dates, number of nights, party size, budget, board basis). This INCLUDES asking about DIFFERENT, ALTERNATIVE, or OTHER dates, options or prices for a potential trip — e.g. "can we look at different dates for Benidorm", "what other dates do you have", "any deals for Spain in September". Wanting different dates/options for a trip they have NOT booked yet is a NEW enquiry = SALES.',
  '- "admin": an EXISTING customer dealing with a record they ALREADY HAVE — EITHER (a) asking about the status/details of an enquiry, quote, or booking they have ALREADY made, their documents / tickets / invoices / itinerary / booking confirmation, or a question/complaint about something ALREADY booked ("my enquiry/quote/booking", "where is my…", "status of my…", "any update on…", "did you send…", "can you resend…"), or AMENDING / CANCELLING a booking or quote they ALREADY HOLD (they refer to an existing booking/quote/reference they made); OR (b) PROVIDING verification / booking identifiers they were asked for — an ID / passport / reference / policy / account / booking number, a date of birth, or a document ("id number: …", "my passport number is…", "here\'s my booking reference"). Changing "dates" is admin ONLY when it is about a booking/quote they ALREADY hold — NOT when exploring dates for a new trip.',
  "  IMPORTANT: a customer simply giving their NAME and PHONE NUMBER so you can find them on the system is NOT the admin case (b) — that is basic identification during a normal (usually sales) enquiry, so classify by the actual topic, not the fact that they gave contact details.",
  "  IMPORTANT: if the customer has no existing booking/quote/reference in view and is talking about a holiday, prefer SALES over admin — admin is only for their OWN already-existing records.",
  '- "general": a greeting ("hi", "hi ai"), small talk, thanks, a general question about the agency (opening hours, do you do X), or ANYTHING with no clear booking or admin intent. This is the DEFAULT when unsure. Do NOT pick admin unless the customer is clearly dealing with a record they ALREADY have.',
  'Respond ONLY with JSON: {"route": "sales" | "admin" | "general"}.',
].join("\n");

// Returns which bot should handle this turn. `enquiryInFlight` short-circuits to
// sales so an in-progress enquiry is never derailed. `priorDomainAdmin` marks a
// conversation already in an admin/support matter (e.g. a complaint) so a terse
// follow-up ("the room is filthy thats it") stays admin instead of falling back
// to sales. Falls back to the current domain on any LLM failure.
export async function classifyConversationRoute(params: {
  transcript: string;
  latestText: string;
  enquiryInFlight: boolean;
  priorDomainAdmin?: boolean;
}): Promise<ConversationRoute> {
  if (params.enquiryInFlight) return "sales";
  // Explicit admin phrasing (asks about records / supplies an id / complaint) →
  // admin, deterministically (beats the LLM).
  if (looksLikeAdminAsk(params.latestText)) return "admin";

  try {
    const stickyNote = params.priorDomainAdmin
      ? "NOTE: this conversation is already an ongoing ADMIN/support matter (e.g. a complaint, document request, or account query). Treat the latest message as ADMIN unless it clearly starts a brand-new holiday search.\n\n"
      : "";
    const res = await getOpenAI().chat.completions.create({
      model: UTILITY_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 20,
      messages: [
        { role: "system", content: ROUTER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `${stickyNote}Conversation so far:\n${params.transcript}\n\nLatest customer message:\n${params.latestText}\n\nClassify the latest message.`,
        },
      ],
    });
    logAiUsage("router", UTILITY_MODEL, res.usage);
    const raw = res.choices[0]?.message?.content?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as { route?: unknown };
      if (parsed.route === "admin") return "admin";
      if (parsed.route === "sales") return "sales";
      if (parsed.route === "general") return "general";
    }
  } catch (err) {
    console.error("[conversation-router] classification failed, defaulting to current domain:", err);
  }
  // Unparseable/failed: stay in the current domain rather than snapping to sales.
  return params.priorDomainAdmin ? "admin" : "general";
}
