import { CHAT_MODEL } from "../../utils/ai-model";
import { getOpenAI, looksLikeAdminAsk } from "./ai-conversation.brain";

// Upper-level ROUTER bot: a small, focused classifier that runs BEFORE either
// specialized bot and decides which one handles the turn:
//   - "sales" → the enquiry bot (new holiday leads / enquiry slot-filling)
//   - "admin" → the admin bot (an EXISTING customer asking about their OWN
//     quotes / enquiries / bookings / tickets / documents)
//
// Kept deliberately SEPARATE from the enquiry bot's large prompt: that prompt
// is enquiry-heavy and classifies routing unreliably, and we don't want to keep
// bolting onto it. Routing lives here in one tiny prompt so the enquiry bot
// stays untouched. Deterministic guards run first (zero-cost, high-precision);
// only genuinely ambiguous messages reach the LLM.

export type ConversationRoute = "sales" | "admin";

const ROUTER_SYSTEM_PROMPT = [
  "You are a message router for a UK travel agency's customer chat. Read the customer's LATEST message (using the conversation for context) and classify it into exactly one route:",
  '- "admin": an EXISTING customer dealing with THEIR OWN account — EITHER (a) asking about the status or details of an enquiry, quote, or booking they already have, their documents / tickets / invoices / itinerary / booking confirmation, or a question/complaint about something already booked ("my enquiry/quote/booking", "where is my…", "status of my…", "any update on…", "did you send…", "can you resend…"); OR (b) PROVIDING personal / verification / booking details they were asked for — an ID / passport / reference / policy / account number, a date of birth, or a document ("here are the details you asked for", "id number: …", "my passport number is…", "here\'s my booking reference"). Supplying identifiers or documents like this is ADMIN, not a new holiday search.',
  '- "sales": the customer wants a NEW holiday or deal, is asking about prices, availability, or destinations for a trip they might book, or is giving details for a new holiday enquiry.',
  'When it is genuinely unclear, choose "sales".',
  'Respond ONLY with JSON: {"route": "admin" | "sales"}.',
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
      model: CHAT_MODEL,
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
    const raw = res.choices[0]?.message?.content?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as { route?: unknown };
      if (parsed.route === "admin") return "admin";
      if (parsed.route === "sales") return "sales";
    }
  } catch (err) {
    console.error("[conversation-router] classification failed, defaulting to current domain:", err);
  }
  // Unparseable/failed: stay in the current domain rather than snapping to sales.
  return params.priorDomainAdmin ? "admin" : "sales";
}
