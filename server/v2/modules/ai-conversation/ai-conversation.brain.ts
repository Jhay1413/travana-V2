import OpenAI from "openai";
import { CHAT_MODEL, UTILITY_MODEL } from "../../utils/ai-model";
import type { NeonClient, OrgBotConfig, OrgKnowledgeBase } from "@shared/schema";
import type { AiTurn, EnquiryBeneficiary, EnquirySlots, RetrievedContext, RetrievedMatch, TranscriptMessage } from "./ai-conversation.types";

// Pure, stateless "brain" functions for AI-driven conversational drivers:
// prompt building, the LLM turn, slot/field bookkeeping, and small reply
// helpers. No transport (SendSeven or otherwise) or persistence concerns
// belong here — those stay with the driver (e.g. reply-worker.service.ts).

const KB_CHAR_BUDGET = 6000;
const QUOTE_REFERENCE_CHAR_BUDGET = 1500;
export const STYLE_EXAMPLE_CHAR_BUDGET = 4000;
const FALLBACK_REPLY = "Thanks for your message — one of our advisors will be in touch shortly.";

// Knowledge-base entries whose `category` is one of these are treated as
// TONE/STYLE examples (e.g. pasted real conversations) rather than factual
// company info — they teach the AI HOW we talk, not WHAT is true. Kept lenient
// so an admin can label them naturally in the KB UI.
const STYLE_EXAMPLE_CATEGORIES = new Set([
  "tone",
  "style",
  "conversation",
  "conversations",
  "conversation example",
  "conversation examples",
  "example conversation",
  "example conversations",
  "tone example",
  "style example",
]);

export function isStyleExampleCategory(category: string | null | undefined): boolean {
  return !!category && STYLE_EXAMPLE_CATEGORIES.has(category.trim().toLowerCase());
}

// Category carried in a vector-retrieved match's metadata (best-effort parse).
function retrievedMatchCategory(m: RetrievedMatch): string | null {
  const meta = m.metadata;
  if (meta && typeof meta === "object" && "category" in meta) {
    const c = (meta as Record<string, unknown>).category;
    return typeof c === "string" ? c : null;
  }
  return null;
}

// Audience carried in a vector-retrieved match's metadata (best-effort parse).
export function retrievedMatchAudience(m: RetrievedMatch): string | null {
  const meta = m.metadata;
  if (meta && typeof meta === "object" && "audience" in meta) {
    const a = (meta as Record<string, unknown>).audience;
    return typeof a === "string" ? a : null;
  }
  return null;
}

// Which bot a piece of audience-tagged content (KB entry or rule) is visible
// to. "sales"/"admin" are the two customer-facing bots; "internal" is the
// staff assistant (kept general-only for now — see plan notes).
export type BotAudience = "sales" | "admin" | "internal";

export function audienceAllows(entryAudience: string | null | undefined, bot: BotAudience): boolean {
  const normalized = (entryAudience || "general").toLowerCase();
  if (normalized === "general") return true;
  if (bot === "internal") return false;
  return normalized === bot;
}

// STRICT variant for RETRIEVED VECTOR MATCHES only. audienceAllows defaults a
// missing audience to "general" (correct for KB rows read straight from the
// DB, which always have a real audience column). But a vector-embedding row's
// metadata can be missing `audience` altogether — e.g. an old backfill that
// pre-dates the audience field, or a failed re-embed after an edit left a
// stale row — and defaulting THAT to "general" would leak restricted content
// (e.g. admin-only KB) to a customer-facing bot. So here, missing/null/
// undefined audience fails CLOSED (not visible to any bot) instead of
// defaulting to "general". Only use this for content sourced from retrieved
// embedding matches; KB rows read directly from the DB must keep using
// audienceAllows.
export function retrievedAudienceAllows(entryAudience: string | null | undefined, bot: BotAudience): boolean {
  if (!entryAudience) return false;
  return audienceAllows(entryAudience, bot);
}

export interface BotRule {
  text: string;
  audience: "general" | "sales" | "admin";
  isActive?: boolean;
}

const RULE_AUDIENCES = new Set(["general", "sales", "admin"]);

// Safe parse of the org_bot_config.rules jsonb column — never throws, drops
// malformed entries rather than failing the whole prompt build.
export function parseBotRules(raw: unknown): BotRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: BotRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const text = (item as Record<string, unknown>).text;
    if (typeof text !== "string" || !text.trim()) continue;
    const audienceRaw = (item as Record<string, unknown>).audience;
    const audience = typeof audienceRaw === "string" && RULE_AUDIENCES.has(audienceRaw) ? (audienceRaw as BotRule["audience"]) : "general";
    const isActiveRaw = (item as Record<string, unknown>).isActive;
    const rule: BotRule = { text: text.trim(), audience };
    if (typeof isActiveRaw === "boolean") rule.isActive = isActiveRaw;
    rules.push(rule);
  }
  return rules;
}

// Renders the audience-scoped subset of bot rules into a system-prompt block.
// These agency rules take PRECEDENCE for TONE, PACING and PHRASING — e.g. an
// agency rule setting a different number of questions per message WINS over
// the default "one thing at a time" asking style — but they can NEVER
// override data-integrity and flow rules: never invent facts/prices/
// availability, never skip identity/verification steps, never promise
// callbacks/handoffs early, and never record details the customer didn't
// state. Used by both the customer-facing bots and the internal assistant
// ("internal" audience).
export function buildRulesBlock(rules: BotRule[], bot: BotAudience): string | null {
  const filtered = rules.filter((r) => audienceAllows(r.audience, bot) && r.isActive !== false);
  if (!filtered.length) return null;
  return (
    "Additional rules you MUST follow (set by the agency). Where a rule conflicts with the default tone, pacing or " +
    "phrasing guidance elsewhere in this prompt — including how many questions to ask per message — the AGENCY RULE " +
    "WINS and takes precedence. Agency rules can NEVER override data-integrity or flow rules, which always win over " +
    "any agency rule (never invent facts, prices or availability; never skip identity/verification steps; never " +
    "promise callbacks/hand-offs early; never record details the customer didn't actually state):\n" +
    filtered.map((r) => `- ${r.text}`).join("\n")
  );
}

// Renders style-example KB entries into a capped block. Framing differs by
// caller (customer bot vs internal assistant), so the header is passed in.
export function buildStyleExamplesBlock(entries: OrgKnowledgeBase[], header: string): string | null {
  const examples = entries.filter((e) => e.isActive && isStyleExampleCategory(e.category));
  if (!examples.length) return null;
  let text = examples.map((e) => `Example — ${e.title}:\n${e.content}`).join("\n\n");
  if (text.length > STYLE_EXAMPLE_CHAR_BUDGET) text = text.slice(0, STYLE_EXAMPLE_CHAR_BUDGET) + "…";
  return `${header}\n${text}`;
}

// A bare acknowledgement from the customer ("ok", "yes", "thanks", 👍…) — used to
// latch confirmation and to end a wound-down conversation.
const ACK_RE = /^(?:ok(?:ay)?|k+|yes|yep|yeah|yh|sure|thanks?|thank you|thx|ty|cheers|great|perfect|cool|nice|alright|got it|noted|fine|good|no worries|brilliant|👍|👌|🙏|😊)[\s!.…🙂😊👍👌🙏]*$/iu;
export function isAcknowledgement(text: string): boolean {
  return ACK_RE.test(text.trim());
}

export function normalizeReply(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
// True when two replies are effectively the same message (guards against the AI
// machine-gunning the same wrap-up line).
export function similarReply(a: string, b: string): boolean {
  const na = normalizeReply(a);
  const nb = normalizeReply(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  return longer.includes(shorter) && shorter.length / longer.length > 0.7;
}

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API key is not configured");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Structurally matches OpenAI's `CompletionUsage` (chat.completions response
// `usage` field) without importing that exact nested type path — kept minimal
// on purpose so this stays SDK-version tolerant.
interface AiUsageLike {
  prompt_tokens: number;
  completion_tokens: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
}

// Prompt-caching observability: one log line per BIG-prompt completion call
// (generateTurn / admin-agent) so cache hit rates are visible in production
// logs. No PII — only the call-site tag, model, and token counts.
// `prompt_tokens_details`/`cached_tokens` may be absent on the response, so
// this stays null-safe throughout.
export function logAiUsage(site: string, model: string, usage: AiUsageLike | null | undefined): void {
  if (!usage) return;
  const cached = usage.prompt_tokens_details?.cached_tokens;
  console.log(
    `[ai-usage] site=${site} model=${model} prompt=${usage.prompt_tokens} cached=${cached ?? "n/a"} completion=${usage.completion_tokens}`,
  );
}

// Deterministic detector for an ADMIN message — an existing customer either (a)
// asking about their OWN records (enquiry/quote/booking/ticket/document/…) or
// (b) PROVIDING verification/booking details they were asked for (an ID /
// passport / reference / policy / account number, or date of birth). Used by the
// upper-level router (conversation-router.ts) as a zero-cost, high-precision
// fast path before its LLM call. Kept tight to avoid hijacking genuine sales
// messages ("book my holiday" does NOT match). \w+ noun stems are typo-tolerant.
const ADMIN_RECORD_NOUN =
  "(?:enqu\\w+|inqu\\w+|quot\\w+|bookings?|ticket\\w*|documents?|docs?|invoices?|itinerar\\w+|confirmations?|files?)";
const ADMIN_ASK_RE = new RegExp(
  "\\b(?:my|our)\\s+(?:latest|recent|last|current|previous|existing|upcoming)?\\s*" + ADMIN_RECORD_NOUN + "\\b",
  "i",
);
// A customer supplying an identifier — e.g. "id number: 123…", "passport no",
// "booking reference", "policy number", "date of birth". Unambiguously admin.
const ADMIN_PROVIDING_RE = new RegExp(
  "\\b(?:id|passport|reference|ref|policy|booking|customer|account|membership|national\\s+insurance|ni)\\s*(?:number|no\\.?|#)\\b" +
    "|\\b(?:passport|id)\\s+details\\b" +
    "|\\bdate\\s+of\\s+birth\\b" +
    "|\\bd\\.?o\\.?b\\.?\\b",
  "i",
);
// A complaint or refund request — inherently a support (admin) matter for an
// existing booking, NOT a new sales lead. Beyond the explicit "complain/refund",
// a handful of strong dissatisfaction words that don't plausibly appear in a new
// holiday enquiry (so they won't hijack a genuine sales lead).
const ADMIN_COMPLAINT_RE =
  /\b(?:complain\w*|refund|filth\w*|disgusting|unhygienic|unacceptable|appalling|cockroach\w*|bed\s?bugs?|ripped?\s+off|not\s+(?:happy|satisfied)|so\s+dirty|really\s+dirty|absolutely\s+filthy)\b/i;
export function looksLikeAdminAsk(text: string): boolean {
  const t = text || "";
  return ADMIN_ASK_RE.test(t) || ADMIN_PROVIDING_RE.test(t) || ADMIN_COMPLAINT_RE.test(t);
}

// The ACTIONABLE subset of admin intent — a complaint or the customer providing
// verification/booking details/documents. These need a staff ticket (unlike a
// read-only "where is my quote?" which the admin bot just answers). Used to gate
// the "stop re-asking, open the ticket now" backstop so it never fires on a
// read-only, multi-turn admin Q&A.
export function looksLikeActionableAdmin(text: string): boolean {
  const t = text || "";
  return ADMIN_PROVIDING_RE.test(t) || ADMIN_COMPLAINT_RE.test(t);
}

// (Phase 3.1) The "stop re-asking, open the ticket now" backstop gate — pulled
// out of reply-worker/internal-chat-testflow into one pure, unit-testable
// function so the two drivers can't drift. The FORCE trigger must NOT rely on
// the STICKY adminActionable flag alone (once true it never clears, so an
// unrelated "thanks" on a later turn would otherwise force a ticket in reply
// to a bare acknowledgement). Instead it requires we already asked a
// clarifying question without opening a ticket (adminAsked) AND the CURRENT
// turn actually carries signal — either it's itself deterministically
// actionable (a fresh complaint/detail/document/attachment), or it's a
// substantive answer to that clarifying question (not a bare "thanks"/"ok"
// acknowledgement, which must never trigger the force).
export interface ForceTicketGateInput {
  adminAsked?: boolean;
  ticketOpened?: boolean;
  latestText: string;
  hasAttachment?: boolean;
}
export function shouldForceTicketNow(input: ForceTicketGateInput): boolean {
  const currentTurnActionable = looksLikeActionableAdmin(input.latestText) || !!input.hasAttachment;
  const isSubstantiveReply = !!input.latestText && !isAcknowledgement(input.latestText);
  return !!input.adminAsked && !input.ticketOpened && (currentTurnActionable || isSubstantiveReply);
}

// (Phase 3.2) Deterministic (non-LLM) route precedence, shared by
// reply-worker/internal-chat-testflow's upper-level router. An enquiry
// already "in flight" stays sales UNLESS this turn carries a deterministic
// ACTIONABLE admin signal (complaint / verification details) or a document
// attachment — that breaks OUT of the sales stickiness so a customer
// mid-enquiry who complains about an existing booking reaches the admin bot
// instead of being funneled into holiday slot-filling. A merely admin-ish but
// NON-actionable question (looksLikeAdminAsk, e.g. "what's the status of my
// enquiry?") does NOT break out — it stays sales-sticky. When no enquiry is
// in flight, an attachment or a deterministic admin ask forces admin;
// otherwise the caller must fall back to the LLM classifier ("classify").
export type DeterministicRoute = "sales" | "admin" | "classify";
export interface RoutePrecedenceInput {
  enquiryInFlight: boolean;
  hasAttachments?: boolean;
  actionable: boolean;
  adminAsk: boolean;
}
export function decideDeterministicRoute(input: RoutePrecedenceInput): DeterministicRoute {
  const hasAttachments = !!input.hasAttachments;
  const complaintBreaksOutOfEnquiry = input.enquiryInFlight && (hasAttachments || input.actionable);
  if (complaintBreaksOutOfEnquiry) return "admin";
  if (input.enquiryInFlight) return "sales";
  if (hasAttachments || input.adminAsk) return "admin";
  return "classify";
}

// The enquiry flow has two code-driven transition points (enquiry just logged →
// ask for a callback time; callback time given → confirm it's booked). Rather
// than send a fixed string, generate the line in the org's house voice (persona
// + KB tone examples) so it doesn't stick out from the rest of the conversation.
// Deterministic control stays in the driver (WHEN to ask/confirm); this only
// produces the WORDING, and falls back to a safe fixed line on any failure.
export type TransitionKind = "ask_callback_time" | "callback_booked";

export async function generateTransitionReply(
  botConfig: OrgBotConfig | null,
  kb: OrgKnowledgeBase[],
  kind: TransitionKind,
  statedTime?: string,
  // When the enquiry was made on behalf of a third party, their name — so the
  // callback wording refers to the traveller ("a call to run through James's
  // options") rather than addressing the sender ("go through YOUR details").
  onBehalfOfName?: string,
): Promise<string> {
  const forFriend = onBehalfOfName?.trim();
  const fallback =
    kind === "ask_callback_time"
      ? forFriend
        ? `Thanks — I've logged that! When would be a good time for the team to give ${forFriend} a quick call to run through the options?`
        : "Thanks — I've logged that for you! What time works best for a quick call so we can go through the details?"
      : forFriend
        ? `Perfect, that's booked in — one of the team will give ${forFriend} a call then. Speak soon!`
        : "Perfect, that's booked in — one of our advisors will call you then. Speak soon!";

  const time = statedTime?.trim();
  const onBehalfNote = forFriend
    ? ` IMPORTANT: this enquiry is on behalf of the sender's friend, ${forFriend} — refer to ${forFriend} (their friend), and do NOT phrase the call as being about "you"/"your trip/details"; it's about ${forFriend}'s holiday.`
    : "";
  const instruction =
    kind === "ask_callback_time"
      ? "The customer's holiday enquiry has just been logged and is being passed to one of the team to look into. Write ONE short, warm message that (a) reassures them you've noted it and the team will get on it, and (b) asks what time would suit for a quick call to go through the details." +
        onBehalfNote +
        " Do NOT ask for any more holiday details. Reply with the message text ONLY."
      : `The customer has just told you when they're free for a call${time ? `, in their own words: "${time}"` : ""}. Write ONE short, warm message confirming that one of the team will give a call then. Reflect their stated time naturally in your own words (e.g. "anytime today" → "we'll give a call at some point today"; "after 5pm tomorrow" → "we'll call after 5 tomorrow") — do NOT use the vague robotic phrase "at that time".${onBehalfNote} End with a friendly sign-off. Reply with the message text ONLY.`;

  try {
    const parts: string[] = [
      `You are ${botConfig?.name?.trim() || "a friendly UK travel agent"} continuing an ongoing chat with a customer for a UK travel agency — do NOT greet them again or open with "hi"/"hey there"/"thanks for reaching out"; just carry on naturally.`,
      "Use UK English. Write in the warm, natural, conversational voice of a friendly UK high-street travel agent — relaxed and human, never robotic, corporate, stiff, or formulaic.",
    ];
    if (botConfig?.persona?.trim()) parts.push(`Tone: ${botConfig.persona.trim()}`);
    const styleBlock = buildStyleExamplesBlock(kb, "Match the tone, warmth and phrasing of these example conversations:");
    if (styleBlock) parts.push(styleBlock);
    const rulesBlock = buildRulesBlock(parseBotRules(botConfig?.rules), "sales");
    if (rulesBlock) parts.push(rulesBlock);
    parts.push(instruction);

    const res = await getOpenAI().chat.completions.create({
      model: UTILITY_MODEL,
      temperature: 0.7,
      messages: [{ role: "system", content: parts.join("\n\n") }],
    });
    logAiUsage("transitionReply", UTILITY_MODEL, res.usage);
    return res.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// (3.3) The three deterministic asks the on-behalf-of-a-friend enquiry flow can
// need mid-conversation: the traveller's name, phone, or both. WHAT is asked is
// fixed (driven by the caller, never invented); only the WORDING is generated
// here in the org's voice/language (botConfig.persona/signOff/language) so a
// non-English or differently-toned tenant doesn't get a hard-coded English aside
// mid-thread. Kept as one tiny, cheap, short-prompt call — no full-context
// generateTurn — and falls back to the previous fixed English line on any
// failure so the turn is never reply-less. Mirrors generateTransitionReply.
export type BeneficiaryAskKind = "name_and_phone" | "name" | "phone";

export async function generateBeneficiaryAsk(
  botConfig: OrgBotConfig | null,
  kb: OrgKnowledgeBase[],
  kind: BeneficiaryAskKind,
  // The traveller's name, when already known (only relevant for kind="phone").
  travellerName?: string,
): Promise<string> {
  const name = travellerName?.trim();
  const fallback =
    kind === "name_and_phone"
      ? "Of course! Could you pop me your friend's name and phone number so I can get this set up for them? 😊"
      : kind === "name"
        ? "Lovely! And what's your friend's name so I can get this set up for them? 😊"
        : `Of course! Could you pop me ${name ?? "your friend"}'s phone number so I can get this set up for them? 😊`;

  const instruction =
    kind === "name_and_phone"
      ? "Ask the customer for their friend's (the traveller's) NAME and PHONE NUMBER so you can get the enquiry set up for them."
      : kind === "name"
        ? "Ask the customer for their friend's (the traveller's) NAME so you can get the enquiry set up for them."
        : `Ask the customer for ${name ?? "their friend"}'s PHONE NUMBER so you can get the enquiry set up for them.`;

  try {
    const parts: string[] = [
      `You are ${botConfig?.name?.trim() || "a friendly UK travel agent"} continuing an ongoing chat with a customer for a UK travel agency — do NOT greet them again or open with "hi"/"hey there"; just carry on naturally.`,
      "Use UK English. Write in the warm, natural, conversational voice of a friendly UK high-street travel agent.",
    ];
    if (botConfig?.persona?.trim()) parts.push(`Tone: ${botConfig.persona.trim()}`);
    if (botConfig?.language?.trim()) parts.push(`Reply in: ${botConfig.language.trim()}`);
    const styleBlock = buildStyleExamplesBlock(kb, "Match the tone, warmth and phrasing of these example conversations:");
    if (styleBlock) parts.push(styleBlock);
    const rulesBlock = buildRulesBlock(parseBotRules(botConfig?.rules), "sales");
    if (rulesBlock) parts.push(rulesBlock);
    parts.push(`${instruction} ONE short, warm sentence only — do NOT ask about anything else. Reply with the message text ONLY.`);

    const res = await getOpenAI().chat.completions.create({
      model: UTILITY_MODEL,
      temperature: 0.7,
      messages: [{ role: "system", content: parts.join("\n\n") }],
    });
    logAiUsage("beneficiaryAsk", UTILITY_MODEL, res.usage);
    return res.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// (3.3) The admin bot's canned "ticket logged" confirmation (Phase 1.3/2.2's
// forceTicketNow override) was a hard-coded English string, bypassing org
// voice/language same as the beneficiary asks above. The MEANING must stay
// deterministic (ticket logged, team will follow up, no further questions) —
// only the wording is generated, via one cheap short-prompt call, falling back
// to the fixed English line on any failure so a forced-ticket turn is never
// reply-less.
export async function generateTicketConfirmation(botConfig: OrgBotConfig | null, kb: OrgKnowledgeBase[]): Promise<string> {
  const fallback = "Thanks — I've logged this with the team and a colleague will be in touch shortly to get it sorted for you.";
  try {
    const parts: string[] = [
      `You are ${botConfig?.name?.trim() || "a friendly UK travel agent"} continuing an ongoing chat with an EXISTING customer of a UK travel agency — do NOT greet them again or open with "hi"/"hey there"; just carry on naturally.`,
      "Use UK English. Write in the warm, natural, conversational voice of a friendly UK high-street travel agent.",
    ];
    if (botConfig?.persona?.trim()) parts.push(`Tone: ${botConfig.persona.trim()}`);
    if (botConfig?.signOff?.trim()) parts.push(`Sign-off: ${botConfig.signOff.trim()}`);
    if (botConfig?.language?.trim()) parts.push(`Reply in: ${botConfig.language.trim()}`);
    const styleBlock = buildStyleExamplesBlock(kb, "Match the tone, warmth and phrasing of these example conversations:");
    if (styleBlock) parts.push(styleBlock);
    parts.push(
      "You have JUST logged a support ticket for this customer's request with the team. Write ONE short, warm confirmation message that (a) confirms it's been logged, and (b) reassures them a colleague will follow up shortly. Do NOT ask any further questions. Reply with the message text ONLY.",
    );

    const res = await getOpenAI().chat.completions.create({
      model: UTILITY_MODEL,
      temperature: 0.7,
      messages: [{ role: "system", content: parts.join("\n\n") }],
    });
    logAiUsage("ticketConfirmation", UTILITY_MODEL, res.usage);
    return res.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// LEGACY / UNUSED BY THE DRIVERS as of the "create-immediately" change: the
// grouped follow-up (asking for still-missing OPTIONAL fields in one go,
// before creating the enquiry on the customer's NEXT reply) has been removed
// from both reply-worker.service.ts and internal-chat-testflow.service.ts —
// they now create the enquiry immediately once the required core fields land
// (or the ask-cap is hit), on the same turn, via shouldCreateEnquiryNow below.
// Left in place (not deleted) in case another caller/test still exercises it;
// do not wire this back into a driver without re-checking that decision.
export async function generateGroupedAsk(
  botConfig: OrgBotConfig | null,
  kb: OrgKnowledgeBase[],
  missingFields: string[],
  transcript: string,
): Promise<string> {
  const fallback = buildGroupedAskReply(missingFields);
  if (!missingFields.length) return fallback;
  try {
    const parts: string[] = [
      `You are ${botConfig?.name?.trim() || "a friendly UK travel agent"} in the MIDDLE of an ongoing chat with a customer about booking a holiday. Continue the conversation naturally — do NOT greet them again or open with things like "hi", "hey there", or "thanks for reaching out"; just carry straight on from where the chat is.`,
      "Use UK English. Warm, natural, conversational voice of a friendly UK high-street travel agent. Do NOT format as a bulleted/numbered list or a form — one or two short sentences only.",
    ];
    if (botConfig?.persona?.trim()) parts.push(`Tone: ${botConfig.persona.trim()}`);
    const styleBlock = buildStyleExamplesBlock(kb, "Match the tone, warmth and phrasing of these example conversations:");
    if (styleBlock) parts.push(styleBlock);
    if (transcript.trim()) parts.push(`The conversation so far:\n${transcript.trim()}`);
    // The agency rules block is pushed immediately before the pacing
    // instruction below (not earlier) so it sits directly next to the
    // default it's most likely to override (how many questions to ask).
    const rulesBlock = buildRulesBlock(parseBotRules(botConfig?.rules), "sales");
    if (rulesBlock) parts.push(rulesBlock);
    parts.push(
      "DEFAULT PACING (an agency rule above may set a DIFFERENT number of questions per message — if one does, FOLLOW THE AGENCY RULE for pacing, not this default): unless overridden, ask the customer for only the ONE (at most TWO, and only if they naturally go together) most useful detail still needed to find them a good deal, in one or two short warm sentences. Do NOT stack several separate questions into one message or make it read like a list/form. " +
        "CRUCIAL: read what they have ALREADY told you above and do NOT re-ask anything they've answered or said they have no preference on — e.g. if they said they're open to suggestions or just want 'somewhere hot near the beach', that IS their destination answer, so do NOT ask where they want to go. " +
        "Prioritise, in order: the destination (ONLY if they have not named one AND have not said they're flexible/open to suggestions), travel dates, number of nights, budget, then board basis. " +
        "Do NOT say a colleague/advisor/the team will call, be in touch, or get back to them, and do NOT say things like 'I've got everything I need' or 'all sorted' — that step happens automatically later; just warmly ask for the next detail. " +
        "These are the fields still marked missing (use as a guide, but the conversation above is the source of truth for what they've already said): " +
        `${missingFields.join(", ")}. Reply with the message text ONLY.`,
    );
    const res = await getOpenAI().chat.completions.create({
      model: UTILITY_MODEL,
      temperature: 0.7,
      messages: [{ role: "system", content: parts.join("\n\n") }],
    });
    logAiUsage("groupedAsk", UTILITY_MODEL, res.usage);
    return res.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// The "general" route (see conversation-router.ts): the customer is just
// greeting/chatting/asking a general question — no booking intent, no admin
// intent. A lean conversational reply, deliberately kept separate from the
// enquiry bot's onboarding gate and slot-filling machinery: it must NOT ask
// for name/phone or try to collect a holiday enquiry. Falls back to a safe
// fixed line on any failure.
export async function generateGeneralReply(
  botConfig: OrgBotConfig | null,
  kb: OrgKnowledgeBase[],
  transcript: string,
  clientRecord: NeonClient | null,
): Promise<string> {
  const fallback = "Hi! How can I help you today?";
  try {
    const parts: string[] = [
      `You are ${botConfig?.name?.trim() || "a friendly assistant"}, chatting with a customer of a UK travel agency.`,
    ];
    if (clientRecord) {
      const clientName = [clientRecord.title, clientRecord.firstName, clientRecord.surename].filter(Boolean).join(" ").trim();
      if (clientName) parts.push(`You are speaking with ${clientName}.`);
    }
    parts.push(
      "Use UK English. Warm, natural, friendly UK high-street travel agent voice — never robotic or corporate. Continue naturally; if the conversation has already started, do NOT re-greet.",
    );
    parts.push(
      "The customer is just chatting, greeting you, or asking a general question — they have NOT asked to book a holiday and are NOT asking about an existing booking. So: do NOT ask for their name, phone, destination, dates, budget, or who's travelling; do NOT try to collect a holiday enquiry; do NOT assume they want to book. Just reply warmly and helpfully, answer any general question from the company info below, and (if it fits) ask ONE open question like 'what can I help you with today?'. Keep it short — one or two sentences.",
    );
    if (botConfig?.persona?.trim()) parts.push(`Persona: ${botConfig.persona.trim()}`);
    if (botConfig?.greeting?.trim()) parts.push(`Greeting style: ${botConfig.greeting.trim()}`);
    if (botConfig?.signOff?.trim()) parts.push(`Sign-off: ${botConfig.signOff.trim()}`);
    if (botConfig?.language?.trim()) parts.push(`Reply in: ${botConfig.language.trim()}`);

    // GENERAL-only KB entries: audienceAllows(x, "internal") is true only for
    // general-audience entries, which is exactly the scope wanted here.
    const activeGeneralKb = kb.filter((k) => k.isActive && audienceAllows(k.audience, "internal"));
    const factKb = activeGeneralKb.filter((k) => !isStyleExampleCategory(k.category));
    if (factKb.length) {
      let company = factKb.map((k) => `- ${k.title}: ${k.content}`).join("\n");
      if (company.length > KB_CHAR_BUDGET) company = company.slice(0, KB_CHAR_BUDGET) + "…";
      parts.push(`Company information (use to answer accurately):\n${company}`);
    }

    const styleBlock = buildStyleExamplesBlock(activeGeneralKb, "Match the tone/warmth of these example conversations:");
    if (styleBlock) parts.push(styleBlock);

    const rulesBlock = buildRulesBlock(parseBotRules(botConfig?.rules), "internal");
    if (rulesBlock) parts.push(rulesBlock);

    const res = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.6,
      messages: [
        { role: "system", content: parts.join("\n\n") },
        { role: "user", content: `Conversation so far:\n${transcript}\n\nReply to the customer's latest message.` },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// The sales-audience "fact" KB rows (isActive, audience allows "sales", not a
// tone/style example) — the exact subset `buildSystemPrompt` embeds as static
// company info in the sales system prompt. Factored out to ONE place so
// `kbExceedsBudget` and `buildSystemPrompt` can never drift on what counts as
// "the static KB".
function salesFactKb(kb: OrgKnowledgeBase[]): OrgKnowledgeBase[] {
  return kb.filter((k) => k.isActive && audienceAllows(k.audience, "sales") && !isStyleExampleCategory(k.category));
}

// Whether the static sales-audience fact KB alone already overflows
// KB_CHAR_BUDGET once rendered into the system prompt. When it does NOT, the
// vector-retrieved `sourceType: "knowledge"` matches would just be embeddings
// of these same rows appended to a prompt that already contains all of
// them — pure duplication — so callers use this to skip that retrieval call
// entirely. The static KB is still fetched fresh from the DB every turn
// either way, so newly added knowledge keeps reaching the prompt immediately.
export function kbExceedsBudget(kb: OrgKnowledgeBase[]): boolean {
  const factKb = salesFactKb(kb);
  const company = factKb.map((k) => `- ${k.title}: ${k.content}`).join("\n");
  return company.length > KB_CHAR_BUDGET;
}

// buildSystemPrompt is deliberately ordered STATIC-PREFIX-FIRST, DYNAMIC-TAIL-
// LAST so OpenAI's automatic prompt caching (which caches the longest
// byte-identical prompt PREFIX, ≥1024 tokens, in 128-token increments) can
// reuse the shared prefix across every turn/customer for a given org, instead
// of the cache breaking on per-customer/per-turn content that used to sit
// mid-prompt. See buildAdminSystemPrompt (admin-agent.service.ts) for the
// admin-bot equivalent.
//
// STATIC PER ORG (prefix — identical for every customer/turn of this org,
// bar the daily-changing "today's date" line):
//   1. bot identity/persona/greeting/sign-off/language lines
//   2. general behaviour ("never quote firm prices…")
//   3. enquiry slot-filling instructions
//   4. DEFAULT ASKING STYLE immediately followed by the agency rules block
//      (kept adjacent on purpose — see the comment at the push site — so the
//      agency rule wins precedence over the default it overrides)
//   5. remaining slot-filling/flow instructions
//   6. CRITICAL "how the enquiry gets logged" + the JSON response-format spec
//   7. ENQUIRING ON BEHALF OF SOMEONE ELSE (beneficiary/on-behalf rules)
//   8. hand-off instructions
//   9. company KB block (static fact-KB rows only, capped at KB_CHAR_BUDGET)
//  10. style-examples block
//
// DYNAMIC TAIL (last — varies per customer/turn, so it must NOT sit in the
// cached prefix):
//   11. the client record line ("You are speaking with …")
//   12. vector-retrieved KB matches for THIS message (small, separate block —
//       see the KB-split note below)
//   13. vector-retrieved similar past quotes for THIS message
//   14. the known/unknown-contact onboarding branch block
export function buildSystemPrompt(
  botConfig: OrgBotConfig | null,
  kb: OrgKnowledgeBase[],
  client: NeonClient | null,
  knownClient: boolean,
  retrieved?: RetrievedContext,
): string {
  const name = botConfig?.name?.trim() || "the assistant";
  const parts: string[] = [
    `You are ${name}, an AI assistant replying to customers on behalf of a UK travel agency.`,
    `Today's date is ${new Date().toISOString().slice(0, 10)}. Any travel dates must be in the future.`,
    "Use UK English and GBP. Write in the warm, natural, conversational voice of a friendly UK high-street travel agent — relaxed and human, never robotic, corporate, stiff, or formulaic. Vary your wording; do not open messages with the same canned phrase each time.",
    "MOST IMPORTANT RULE: NEVER assume the customer wants to book a holiday. If everything they've said so far is just a greeting (e.g. \"hi\", \"hi ai\"), small talk, or their name/phone — with NO mention of a trip, destination, dates, or wanting to travel — then do NOT ask about destinations, dates, nights, budget or who's travelling, do NOT start an enquiry, and set intent to \"other\". Simply greet them warmly and ask ONE open question like \"what can I help you with today?\". Only begin helping with a holiday once THEY have actually said they want one.",
  ];

  if (botConfig?.persona?.trim()) parts.push(`Persona: ${botConfig.persona.trim()}`);
  if (botConfig?.preferredResponse?.trim()) parts.push(`How to respond: ${botConfig.preferredResponse.trim()}`);
  if (botConfig?.greeting?.trim()) parts.push(`Greeting style: ${botConfig.greeting.trim()}`);
  if (botConfig?.signOff?.trim()) parts.push(`Sign-off: ${botConfig.signOff.trim()}`);
  if (botConfig?.language?.trim()) parts.push(`Reply in: ${botConfig.language.trim()}`);

  // The agency rules block is pushed immediately after the ASKING STYLE
  // instruction below (not here) so it sits right next to the pacing
  // guidance it's most likely to override — see the push further down.
  const rulesBlock = buildRulesBlock(parseBotRules(botConfig?.rules), "sales");

  parts.push(
    "Never quote firm prices, availability, or confirm bookings you cannot verify — instead gather the enquiry and let a human advisor follow up.",
  );

  // Enquiry slot-filling instructions (§14). There is NO confirmation gate —
  // and NO grouped follow-up round for optional fields either: the worker (in
  // code) creates the enquiry as soon as the required CORE fields land (or the
  // ask-cap is hit), on that same turn. Whatever nice-to-have fields are still
  // missing at that point simply go into the enquiry note (see missingFieldsFor).
  parts.push(
    [
      "If the customer is enquiring about a holiday, capture it conversationally — do NOT wait for the customer to confirm before it can be logged, and do NOT insist on collecting every field before you can help further.",
      "- DO NOT ASSUME THE CUSTOMER WANTS TO BOOK. If they have only greeted you (e.g. \"hi\", \"hi ai\"), made small talk, or not yet said what they want, do NOT ask for destination, dates, nights, budget, or who's travelling — greet them warmly and ask ONE open question about how you can help. Only start collecting holiday details ONCE they've actually expressed interest in a trip/holiday; until then set intent=\"other\".",
      "- CRITICAL: Only record details the customer has ACTUALLY stated in this conversation. Never invent, guess, infer or pad out destinations, board basis, star ratings, budgets or any other value they did not say. Do not repeat a value multiple times. If unsure, leave it empty.",
      "- The 'Current enquiry status' and 'Known enquiry details' provided below are the AUTHORITATIVE source of what's already captured. Earlier messages in the transcript may show a PREVIOUS enquiry that was already logged — do NOT say things like 'we already have your enquiry' or refuse to help based on them. If the current status is none/collecting and the customer shows holiday interest, treat it as a brand-new enquiry and collect it from scratch.",
      '- Classify the holiday type into one of: "Package Holiday" (default), "Cruise Package", "Hot Tub Break".',
      '- `boardBasis` (only if they mentioned meals/board) must use these exact values: "All Inclusive", "Bed and Breakfast", "Self Catering", "Half Board", "Full Board", "Room Only". `starRating` (only if they mentioned a hotel star rating) must be one of: "2 Star", "3 Star", "4 Star", "5 Star" — a word like "luxury" is NOT a star rating.',
      "- These are the fields for the detected holiday type — EXTRACTION targets, not an asking checklist. Capture any of them the moment the customer mentions one unprompted, but see the ASKING STYLE rule below for which of these you are actually allowed to proactively ask about (only a small core subset — never the rest):",
      "   • Package Holiday: destination, resort, departure airport, travel date, number of nights, passengers (adults/children/infants + child ages), board basis, minimum star rating, budget.",
      "   • Hot Tub Break: destination, resort, travel date, number of nights, number of guests, weekend lodge (yes/no), pets (how many), budget.",
      "   • Cruise Package: destination(s) (record in `destinations`), travel date, number of nights, passengers, cabin type, cruise line, pre-cruise stay nights, post-cruise stay nights, departure airport, budget.",
      "- Extract everything mentioned so far into `slots` (merge with the known details you are given): use fields enquiryTitle, holidayType, countries, destinations, resorts, departureAirports, boardBasis, starRating, travelDate, flexibility, nights, adults, children, infants, childAges, budget, budgetType, cabinType, cruiseLine, preCruiseStay, postCruiseStay, guests, pets, weekendLodge, accommodationType, notes. Leave unknown fields empty.",
      '- DATES: `travelDate` must be a single specific calendar date in YYYY-MM-DD format, and ONLY when the customer gave a specific date. If the customer gives a day/month with no year, assume the NEXT future occurrence (never a past date). If they give a range or vague timing (e.g. "mid to end of August", "New Year", "sometime in summer", "October school holidays", "not sure"), leave `travelDate` empty and record their exact wording in `notes`. Do NOT invent an exact date.',
      '- FLEXIBILITY: always leave `flexibility` EMPTY — do not populate it at all, even for vague timing (that wording goes in `notes` only, per the DATES rule above).',
      '- NIGHTS: put the number of nights in `nights` whenever it is stated or clearly implied — e.g. "4 nights" → 4, "a week" → 7, "10 days" → 10, "a fortnight" → 14, "long weekend" → 3. Leave empty if they haven\'t indicated a length.',
      '- BUDGET: put the amount as digits only in `budget` (no "£", commas or words — e.g. "1100"), and set `budgetType` to exactly "Per Person" or "Package". If they give a range (e.g. "1000-2000"), record the TOP of the range.',
      '- DEPARTURE AIRPORT: whenever the customer says they will "fly from", "flying from", "depart(ing) from", "leave from", or simply "from" a place (e.g. "fly from Newcastle", "from Manchester", "out of Gatwick"), record that airport/city in `departureAirports` as an array (e.g. ["Newcastle"]). This is the airport they leave the UK from — do NOT confuse it with their holiday destination.',
    ].join("\n"),
  );

  // ASKING STYLE + the agency rules block are pushed as adjacent, standalone
  // parts (rather than buried inside the longer enquiry-instructions block
  // above) so the pacing override sits immediately next to the default it
  // overrides — the model weighs adjacent instructions together, and a rule
  // separated by several paragraphs was losing out to the earlier default.
  parts.push(
    [
      "- DEFAULT ASKING STYLE (an agency rule below may set a DIFFERENT NUMBER of questions per message — if one does, FOLLOW THE AGENCY RULE for HOW MANY questions to ask per message; it can NEVER change WHICH fields you're allowed to ask about, which is fixed below regardless of any agency rule): unless an agency rule says otherwise, every message should be SHORT — at most two sentences — and ask about only ONE thing at a time (or two ONLY if they naturally belong together, e.g. number of adults and children). By default do NOT stack several separate questions into one reply. You may ONLY proactively ask about the required CORE fields, in this priority order: destination (only if they haven't given one and aren't open to suggestions), then rough dates, then number of nights, then party size (adults for Package/Cruise, guests for Hot Tub), then budget — deliberately leave the rest for later messages and pick them up naturally over the next few replies. Never reel off a list, never make it read like a form, and never re-ask a detail they've already given or declined.",
      "- HOT TUB BREAKS AND AREA/RADIUS: for Hot Tub Break enquiries, if the customer gives an AREA or RADIUS instead of a named destination (e.g. \"within an hour's drive of Newcastle\", \"near me in the North East\", \"somewhere close by\"), that IS their location answer — record it in `notes`, do NOT ask for a destination, and never re-ask where they want to go.",
      "- Do NOT ask about resort, board basis, minimum star rating, departure airport, accommodation type, cabin type, cruise line, pre-cruise stay, post-cruise stay, weekend lodges, or pets — these are nice-to-have fields and you must NEVER proactively ask about them, no matter how many questions per message an agency rule allows. If the customer VOLUNTEERS one of these unprompted, extract and record it into `slots` exactly as normal — you just must never be the one who brings it up.",
    ].join("\n"),
  );
  if (rulesBlock) parts.push(rulesBlock);

  parts.push(
    [
      "- Do NOT offer to arrange a call, a callback, or say a colleague/advisor/the team will be in touch while you are still gathering enquiry details — that step happens later and automatically, so leave it out and just ask the next detail.",
      "- For each field: if they give a value, record it in `slots`. If they say no / none / not sure / no preference / any / doesn't matter, treat that field as ANSWERED — leave it empty, do NOT store it, and never ask about it again.",
      "- If it is not a holiday enquiry, set intent=\"other\" and just answer helpfully.",
      '- If the "Current enquiry status" given below is "awaiting_availability", the customer\'s enquiry has ALREADY been logged and they are now being asked what time suits a callback — just acknowledge their answer helpfully, do not re-collect enquiry details or treat it as a new enquiry.',
    ].join("\n"),
  );

  parts.push(
    [
      "CRITICAL — HOW THE ENQUIRY GETS LOGGED: the enquiry is created from the `slots` object, NOT from your `reply` text. You MUST copy EVERY holiday detail the customer has stated so far into `slots` on EVERY turn — carry forward everything from earlier messages too, don't just include the newest detail. If the customer has said e.g. \"Benidorm, 2 adults, £500, 1st September\", then `slots` MUST contain destinations:[\"Benidorm\"], adults:2, budget:\"500\", travelDate:\"2025-09-01\" (next future date). Putting details only in `reply` and leaving `slots` empty means the enquiry is LOST and never logged — this is the single most important rule.",
      "While the customer is giving or refining holiday details, keep intent=\"enquiry\" (do NOT switch to \"other\" just because you're wrapping up a detail).",
      "Do NOT tell the customer you've \"got everything\", it's \"all sorted\", or that the team/an advisor will call or be in touch — the system handles logging the enquiry and arranging the callback automatically AFTER you. Just keep gathering details or answer their question.",
    ].join("\n"),
  );

  parts.push(
    'Respond ONLY with JSON: {"hand_off": boolean, "intent": "enquiry"|"other", "slots": object, "client": {"fullName": string, "phone": string}, "beneficiary": {"onBehalf": boolean, "fullName": string, "phone": string}, "reply": string}. `reply` is the message to send the customer; `slots` MUST carry every holiday detail stated so far (see the CRITICAL rule above); `client` holds any personal details the SENDER has given (empty strings if unknown); `beneficiary` is only for when they are enquiring on another named person\'s behalf (onBehalf=false otherwise).',
  );

  parts.push(
    [
      "ENQUIRING ON BEHALF OF SOMEONE ELSE: If the customer makes clear the holiday is for ANOTHER person and they themselves are NOT one of the travellers — e.g. \"my friend James wants to book Benidorm\", \"I'm enquiring for my mum Susan\", \"my friend saw your Benidorm post\" — then:",
      "  • set beneficiary.onBehalf=true. Put the traveller's REAL name in beneficiary.fullName ONLY if they've actually told you it. NEVER put a generic word like \"friend\", \"my friend\", \"your friend\", \"mate\", or \"my mum\" in beneficiary.fullName — that is NOT a name. If you don't have their real name yet, leave beneficiary.fullName EMPTY.",
      "  • if you DO have the traveller's real name, do NOT ask for it again — just ask for their phone (naming them, e.g. \"Can I grab James's phone number?\"). If you do NOT have their real name, ask for their NAME and phone number (e.g. \"Of course! What's your friend's name and number so I can set this up for them?\"). Either way, do NOT ask the sender for their OWN name or number.",
      "  • once they give it, put the traveller's phone in beneficiary.phone.",
      "  • keep capturing all the holiday details they mention into `slots` exactly as normal — the enquiry is for the traveller.",
      "  • carry beneficiary.onBehalf=true and beneficiary.fullName on EVERY following turn of this same enquiry, even after you have the phone.",
      "If the sender IS one of the travellers (e.g. \"me and James want to go\", \"a trip for me and my wife\", \"we'd like to book\"), this is NOT enquiring on someone's behalf — leave beneficiary.onBehalf=false and handle it as their own enquiry.",
    ].join("\n"),
  );

  const handoff = [
    "Set hand_off=true ONLY if the customer explicitly asks for a human/agent, is clearly upset or complaining, or makes a request genuinely unrelated to booking a holiday.",
    "NEVER hand off just because an enquiry looks already logged, repeated, or previously mentioned, or because you've said 'an advisor will get back' before — a repeated or restated holiday interest is NOT a hand-off reason; help with it as a normal enquiry.",
    botConfig?.handoffInstructions?.trim() || "",
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(handoff);

  // Company info: STATIC fact-KB rows only, capped at KB_CHAR_BUDGET — kept as
  // its own block so this part of the prefix stays byte-identical turn-to-turn
  // regardless of what the vector search returns this turn (see the retrieved-
  // KB tail block below for the per-turn matches, which used to be folded into
  // this same capped string and would otherwise break the cached prefix).
  const activeKb = kb.filter((k) => k.isActive && audienceAllows(k.audience, "sales"));
  const factKb = salesFactKb(kb);
  if (factKb.length) {
    let company = factKb.map((k) => `- ${k.title}: ${k.content}`).join("\n");
    if (company.length > KB_CHAR_BUDGET) company = company.slice(0, KB_CHAR_BUDGET) + "…";
    parts.push(`Company information (use it to answer accurately):\n${company}`);
  }

  // Tone/style examples (e.g. real conversations pasted into the KB) — these
  // teach HOW we talk, not what is true.
  const styleBlock = buildStyleExamplesBlock(
    activeKb,
    "How our team talks to customers — study these real example conversations and MATCH this tone, warmth, phrasing and overall approach in your replies. They are STYLE examples ONLY: do NOT treat the specific holidays, destinations, dates, prices, phone numbers or customers in them as real, current, or relevant to this conversation.",
  );
  if (styleBlock) parts.push(styleBlock);

  // --- DYNAMIC TAIL below: everything from here on varies per customer/turn,
  // so it is deliberately kept OUT of the static prefix above (prompt-caching
  // optimization) — see the block comment above this function. ---

  if (client) {
    parts.push(`You are speaking with ${[client.title, client.firstName, client.surename].filter(Boolean).join(" ")}.`);
  }

  // Vector-retrieved KB matches for THIS message (Phase 5d) — rendered as
  // their own small tail block (rather than folded into the static company-
  // info block above) so the static prefix stays byte-stable; these are
  // already individually small (retrieval is capped at 3 matches).
  const retrievedKb = (retrieved?.kb ?? []).filter(
    (m) => !isStyleExampleCategory(retrievedMatchCategory(m)) && retrievedAudienceAllows(retrievedMatchAudience(m), "sales"),
  );
  if (retrievedKb.length) {
    const retrievedLines = retrievedKb.map((m) => `- ${m.content}`).join("\n");
    parts.push(`Possibly relevant knowledge for THIS message:\n${retrievedLines}`);
  }

  // Vector-retrieved similar past quotes (Phase 5d) — internal context only, never
  // to be surfaced as a firm price/availability/promise to the customer.
  const retrievedQuotes = retrieved?.quotes ?? [];
  if (retrievedQuotes.length) {
    let quotesText = retrievedQuotes.map((m) => `- ${m.content}`).join("\n");
    if (quotesText.length > QUOTE_REFERENCE_CHAR_BUDGET) quotesText = quotesText.slice(0, QUOTE_REFERENCE_CHAR_BUDGET) + "…";
    parts.push(
      "Reference — similar past trips (INTERNAL ONLY — do NOT quote prices, availability, or promise these to the customer; " +
        `use only to ask better questions and suggest ideas):\n${quotesText}\n\n` +
        "Reminder: never quote firm prices or availability from this reference — always gather the enquiry and let a human advisor follow up.",
    );
  }

  // Client onboarding gate: collect details before anything else for unknown
  // contacts. Only a name and phone number are required — we do NOT ask for
  // email. Kept last (dynamic tail) because it depends on `knownClient`,
  // which varies per contact.
  if (!knownClient) {
    parts.push(
      [
        "IMPORTANT — this customer is NOT on our system yet. Your FIRST reply must do TWO things in one short, friendly message:",
        "  1. Briefly acknowledge their message in a natural, friendly way so they know you've understood what they asked — the way a warm UK travel agent would reassure them you can help. VARY your wording naturally to fit their message; do NOT open with a canned phrase like \"Of course\". Keep it to a line, and do NOT start answering the enquiry or asking holiday details yet.",
        "  2. Then ask for their NAME and PHONE NUMBER so you can check them on the system — phrase it naturally and casually in the message, e.g. \"can you pop me your name and phone number so I can check you're on the system?\". Do NOT ask for an email address, and do NOT use stiff phrasing like \"set up your file\".",
        "  EXCEPTION: if they are enquiring on behalf of ANOTHER named person and are not travelling themselves (see the 'ENQUIRING ON BEHALF OF SOMEONE ELSE' rules above), do NOT ask the sender for their own name/phone — follow those rules and ask for the TRAVELLER's phone instead.",
        "- On every reply after that, look at what they have already given and ask ONLY for what is still missing — e.g. if they gave just their name, ask for their phone number only. NEVER re-ask for a detail they have already provided.",
        "- Put whatever they provide into `client`: { fullName, phone } — leave a field as an empty string until they actually give it.",
        "Only once you have BOTH their name and phone, give a brief confirmation that you can see them on the system (e.g. \"That's great, I can see you on the system\"), then respond to WHAT THEY ACTUALLY ASKED FOR: if they've already shown they want a holiday, carry on helping with that; if they only greeted you or haven't said what they need, ask an OPEN, friendly question about how you can help (e.g. \"what can I help you with today?\") — do NOT assume they want to book, and do NOT start asking for destination, dates, or who's travelling. Do not start collecting holiday enquiry details until you have their name and phone AND they've actually expressed interest in a holiday.",
      ].join("\n"),
    );
  }

  return parts.join("\n\n");
}

// Deterministic backstop for holidayType — the model's slot extraction is
// unreliable turn-to-turn (it can return empty slots even when "cruise" is
// plainly stated somewhere in the conversation), so the type is recovered
// deterministically from the transcript text rather than trusting the model to
// have captured it on some persisted turn. Callers should run this over the
// FULL transcript (not just the latest message) so a "cruise" mention on any
// earlier turn — including turns before the enquiry itself started — still
// counts. Returns null (leave holidayType unset) when nothing matches, so the
// Package Holiday default at enquiry creation still applies.
export function inferHolidayTypeFromText(text: string): string | null {
  const t = text || "";
  if (/\bcruise/i.test(t)) return "Cruise Package";
  if (/\bhot\s*tub|\blodge\b/i.test(t)) return "Hot Tub Break";
  return null;
}

// The full set of keys EnquirySlots recognises — used by normalizeTurnSlots to
// drop anything the model invents (e.g. `cruiseDestination`) so persisted
// slots stay clean.
const KNOWN_SLOT_KEYS: ReadonlyArray<keyof EnquirySlots> = [
  "enquiryTitle",
  "holidayType",
  "countries",
  "destinations",
  "resorts",
  "departureAirports",
  "boardBasis",
  "starRating",
  "travelDate",
  "flexibility",
  "nights",
  "adults",
  "children",
  "infants",
  "childAges",
  "budget",
  "budgetType",
  "cabinType",
  "cruiseLine",
  "preCruiseStay",
  "postCruiseStay",
  "guests",
  "pets",
  "weekendLodge",
  "accommodationType",
  "notes",
];

// Normalizes the model's raw slots JSON into a clean EnquirySlots object —
// applied at the one point the model's JSON becomes an EnquirySlots (inside
// generateTurn) so it fixes every driver (reply-worker, internal-chat-testflow)
// at once rather than patching each one. Handles two recurring model mistakes:
// (a) the prompt used to teach "cruise destination" as a Cruise Package field
// even though the schema field is `destinations` — the model would then return
// an invalid `cruiseDestination`/`cruiseDestinations` key instead. That's now
// fixed in the prompt (§ slot-filling instructions above), but we still alias
// it defensively here in case the model reverts to habit. (b) any other key
// the model invents is dropped so persisted slots stay clean. `holidayType` is
// also canonicalized so downstream keyword checks (e.g. fieldChecksFor's
// `.includes("cruise")`) reliably light up regardless of the model's casing.
export function normalizeTurnSlots(raw: Record<string, unknown>): EnquirySlots {
  const slots: EnquirySlots = {};
  for (const key of KNOWN_SLOT_KEYS) {
    if (raw[key] !== undefined) {
      (slots as Record<string, unknown>)[key] = raw[key];
    }
  }

  // Alias cruiseDestination / cruiseDestinations (string or array) → destinations,
  // merging with (not clobbering) anything already extracted into destinations.
  const aliasRaw = raw.cruiseDestination ?? raw.cruiseDestinations;
  if (aliasRaw !== undefined) {
    const values = Array.isArray(aliasRaw) ? aliasRaw : [aliasRaw];
    const strings = values.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    if (strings.length) {
      const existing = Array.isArray(slots.destinations) ? slots.destinations : [];
      const merged = [...existing];
      for (const s of strings) if (!merged.includes(s)) merged.push(s);
      slots.destinations = merged;
    }
  }

  // Canonicalize holidayType casing/shorthand.
  if (typeof slots.holidayType === "string" && slots.holidayType.trim()) {
    const t = slots.holidayType;
    if (/cruise/i.test(t)) slots.holidayType = "Cruise Package";
    else if (/hot\s*tub|lodge/i.test(t)) slots.holidayType = "Hot Tub Break";
    else if (/package/i.test(t)) slots.holidayType = "Package Holiday";
  }

  return slots;
}

// `messages` only needs the minimal transcript shape (direction/text/created_at)
// so this stays free of any single driver's transport message type (e.g.
// SendSeven's SsMessage) — callers with a wider/compatible shape pass it as-is.
export function buildTranscript(messages: TranscriptMessage[], latest: string): string {
  const t = [...messages]
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    .filter((m) => m.text && m.text.trim())
    .map((m) => `${m.direction === "outbound" ? "Agent" : "Customer"}: ${m.text!.trim()}`)
    .join("\n");
  return t || `Customer: ${latest}`;
}

export async function generateTurn(
  botConfig: OrgBotConfig | null,
  kb: OrgKnowledgeBase[],
  client: NeonClient | null,
  transcript: string,
  status: string | null,
  slots: EnquirySlots,
  knownClient: boolean,
  retrieved?: RetrievedContext,
): Promise<AiTurn> {
  const fallback: AiTurn = { hand_off: true, intent: "other", slots: {}, client: {}, reply: FALLBACK_REPLY };

  let raw: string | undefined;
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 700,
      // Boosts OpenAI's prompt-cache hit rate by bucketing requests for the same
      // org together (the cached prefix built by buildSystemPrompt above is
      // shared per-org) — omitted when the org id isn't available.
      ...(botConfig?.orgId ? { prompt_cache_key: botConfig.orgId } : {}),
      messages: [
        { role: "system", content: buildSystemPrompt(botConfig, kb, client, knownClient, retrieved) },
        {
          role: "user",
          content:
            `Customer on file: ${knownClient ? "yes" : "no — collect their name and phone first"}\n` +
            `Current enquiry status: ${status ?? "none"}\n` +
            `Known enquiry details (JSON): ${JSON.stringify(slots ?? {})}\n\n` +
            `Conversation so far:\n${transcript}\n\n` +
            "Decide the next step and reply.",
        },
      ],
    });
    logAiUsage("generateTurn", CHAT_MODEL, response.usage);
    raw = response.choices[0]?.message?.content?.trim();
  } catch (err) {
    console.error("[ai-conversation.brain] generateTurn OpenAI call failed:", err instanceof Error ? err.message : err);
    return fallback;
  }
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw) as Partial<AiTurn>;
    // Normalize here — the single point the model's JSON becomes an
    // EnquirySlots — so unknown/aliased keys (e.g. `cruiseDestination`) are
    // cleaned up for every caller at once (see normalizeTurnSlots).
    const rawSlots = (p.slots as unknown as Record<string, unknown>) ?? {};
    return {
      hand_off: !!p.hand_off,
      intent: p.intent === "enquiry" ? "enquiry" : "other",
      slots: normalizeTurnSlots(rawSlots),
      client: (p.client as AiTurn["client"]) ?? {},
      beneficiary: (p.beneficiary as EnquiryBeneficiary) ?? {},
      reply: (p.reply ?? "").trim() || FALLBACK_REPLY,
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Holiday-type field checklists — used to (a) gate the immediate enquiry
// creation (see missingCoreFieldsFor/shouldCreateEnquiryNow below) and (b)
// compute the full "additional fields still needed" note written on enquiry
// creation (missingFieldsFor), covering the nice-to-have fields too.
// ---------------------------------------------------------------------------

interface FieldCheck {
  label: string;
  has: (s: EnquirySlots) => boolean;
}

const hasDestination = (s: EnquirySlots): boolean => !!(s.destinations?.length || s.countries?.length || s.resorts?.length);
const hasDates = (s: EnquirySlots): boolean => !!(s.travelDate || s.flexibility);
const hasBudget = (s: EnquirySlots): boolean => !!s.budget;

const PACKAGE_FIELDS: FieldCheck[] = [
  { label: "destination", has: hasDestination },
  { label: "resort (if any preference)", has: (s) => !!s.resorts?.length },
  { label: "departure airport", has: (s) => !!s.departureAirports?.length },
  { label: "travel dates", has: hasDates },
  { label: "number of nights", has: (s) => !!s.nights },
  { label: "number of passengers", has: (s) => !!s.adults },
  { label: "board basis", has: (s) => !!s.boardBasis?.length },
  { label: "minimum star rating", has: (s) => !!s.starRating },
  { label: "budget", has: hasBudget },
];

const CRUISE_FIELDS: FieldCheck[] = [
  { label: "cruise destination", has: hasDestination },
  { label: "travel dates", has: hasDates },
  { label: "number of nights", has: (s) => !!s.nights },
  { label: "number of passengers", has: (s) => !!s.adults },
  { label: "cabin type", has: (s) => !!s.cabinType },
  { label: "cruise line (if any preference)", has: (s) => !!s.cruiseLine },
  { label: "pre-cruise stay nights", has: (s) => !!s.preCruiseStay },
  { label: "post-cruise stay nights", has: (s) => !!s.postCruiseStay },
  { label: "departure airport", has: (s) => !!s.departureAirports?.length },
  { label: "budget", has: hasBudget },
];

const HOTTUB_FIELDS: FieldCheck[] = [
  { label: "destination", has: hasDestination },
  { label: "travel dates", has: hasDates },
  { label: "number of nights", has: (s) => !!s.nights },
  { label: "number of guests", has: (s) => !!s.guests },
  { label: "weekend lodge preference", has: (s) => !!s.weekendLodge },
  { label: "pets", has: (s) => !!s.pets },
  { label: "budget", has: hasBudget },
];

function fieldChecksFor(slots: EnquirySlots): FieldCheck[] {
  const t = (slots.holidayType ?? "").toLowerCase();
  if (t.includes("cruise")) return CRUISE_FIELDS;
  if (t.includes("hot tub")) return HOTTUB_FIELDS;
  return PACKAGE_FIELDS;
}

// The REQUIRED CORE subset of each holiday type's field list — the bot keeps
// collecting (rather than sending the ONE grouped ask) until these land. Same
// shape across package/cruise: destination, travel dates, number of nights,
// party size (adults for package/cruise, guests for hot tub), budget. Hot tub
// is the exception — see HOTTUB_CORE_FIELDS below.
const PACKAGE_CORE_FIELDS: FieldCheck[] = [
  { label: "destination", has: hasDestination },
  { label: "travel dates", has: hasDates },
  { label: "number of nights", has: (s) => !!s.nights },
  { label: "number of passengers", has: (s) => !!s.adults },
  { label: "budget", has: hasBudget },
];

const CRUISE_CORE_FIELDS: FieldCheck[] = [
  { label: "cruise destination", has: hasDestination },
  { label: "travel dates", has: hasDates },
  { label: "number of nights", has: (s) => !!s.nights },
  { label: "number of passengers", has: (s) => !!s.adults },
  { label: "budget", has: hasBudget },
];

// No destination check here on purpose: hot tub lodge customers routinely
// shop by radius/area from home ("within an hour's drive", "near me in the
// North East") rather than a named destination. That area lands in `notes`
// (see the prompt's hot-tub guidance), not `destinations`, so gating core
// completion on hasDestination would mean these enquiries never complete
// naturally and only ever get created at the MAX_ENQUIRY_ASKS cap — or never,
// if the conversation winds down first. The human agent picks parks near the
// customer's stated area; the full HOTTUB_FIELDS checklist below still lists
// destination as a "nice to have" missing field on creation.
const HOTTUB_CORE_FIELDS: FieldCheck[] = [
  { label: "travel dates", has: hasDates },
  { label: "number of nights", has: (s) => !!s.nights },
  { label: "number of guests", has: (s) => !!s.guests },
  { label: "budget", has: hasBudget },
];

function coreFieldChecksFor(slots: EnquirySlots): FieldCheck[] {
  const t = (slots.holidayType ?? "").toLowerCase();
  if (t.includes("cruise")) return CRUISE_CORE_FIELDS;
  if (t.includes("hot tub")) return HOTTUB_CORE_FIELDS;
  return PACKAGE_CORE_FIELDS;
}

// Missing = REQUIRED CORE field list − filled slots. While any of these are
// still missing (and the ask-cap hasn't been hit), the drivers keep collecting
// naturally instead of creating the enquiry.
export function missingCoreFieldsFor(slots: EnquirySlots): string[] {
  return coreFieldChecksFor(slots)
    .filter((f) => !f.has(slots))
    .map((f) => f.label);
}

// The ask-cap keeps the old speed-to-lead behavior as the floor: a customer
// who declines/gives vague answers (e.g. vague dates go to `notes`, never
// `travelDate`, so `hasDates` can stay false forever) still gets their
// enquiry created after at most this many asks, instead of being
// interrogated indefinitely waiting for a core field that will never land.
export const MAX_ENQUIRY_ASKS = 5;

// The single create-trigger decision, pulled out of reply-worker/
// internal-chat-testflow into one pure, unit-testable function so the two
// drivers can't drift (mirrors the shouldForceTicketNow pattern). True once
// the required core fields are complete, OR the ask-cap has been reached, OR
// this conversation already sent the (now-legacy) grouped ask on a prior turn
// before this change shipped — any of those means "stop asking, create the
// enquiry now" rather than sending another follow-up round. Callers still own
// the surrounding gates (treatAsEnquiry / substantive / enquiry status) —
// this only decides the core-vs-ask-cap-vs-legacy question.
export interface CreateEnquiryGateInput {
  coreMissingCount: number;
  askCount: number;
  groupedAskSentLegacy?: boolean;
}
export function shouldCreateEnquiryNow(input: CreateEnquiryGateInput): boolean {
  return !!input.groupedAskSentLegacy || input.coreMissingCount === 0 || input.askCount >= MAX_ENQUIRY_ASKS;
}

export function isEmptySlotValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

// Server-side safety net: the model is prompted to return the full merged
// slot set each turn, but a terse final reply ("ok go ahead") can come back
// sparse. Merge onto the prior (persisted) slots so earlier-captured fields
// are never lost — `next` (this turn) wins wherever it has a real value.
export function mergeSlots(prior: EnquirySlots, next: EnquirySlots): EnquirySlots {
  const merged: EnquirySlots = { ...prior };
  for (const key of Object.keys(next) as Array<keyof EnquirySlots>) {
    const value = next[key];
    if (!isEmptySlotValue(value)) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

// Missing = holiday-type field list − filled slots (used for the "additional
// fields still needed" note written on enquiry creation).
export function missingFieldsFor(slots: EnquirySlots): string[] {
  return fieldChecksFor(slots)
    .filter((f) => !f.has(slots))
    .map((f) => f.label);
}

// Soft anti-empty threshold: at least one substantive detail beyond the
// (default) holiday type, so a bare "hi" never starts the collecting/create
// path.
export function hasSubstantiveSignal(slots: EnquirySlots): boolean {
  return !!(
    slots.destinations?.length ||
    slots.countries?.length ||
    slots.resorts?.length ||
    slots.travelDate ||
    slots.flexibility ||
    slots.nights ||
    slots.budget ||
    slots.adults ||
    slots.children ||
    slots.guests ||
    slots.cabinType ||
    slots.cruiseLine ||
    slots.weekendLodge ||
    slots.pets ||
    slots.preCruiseStay ||
    slots.postCruiseStay ||
    (slots.holidayType && slots.holidayType.trim().toLowerCase() !== "package holiday")
  );
}

// Onboarding phone-number clash: the number the customer gave is already on file
// under one or more OTHER clients whose names don't match the one they gave. Ask
// them to confirm the number (or send the right one) rather than silently
// attaching them to someone else's record. `subjectName` names the person the
// number is meant to be for — omitted for the sender themselves, or e.g. "James"
// when they're enquiring on someone else's behalf. Never discloses the names of
// the other clients the number is already registered under — that would leak
// other clients' PII to whoever typed the number.
export function buildPhoneConflictReply(subjectName?: string): string {
  const subject = subjectName?.trim();
  if (!subject) {
    return "Thanks! Just to double-check — that number is already registered on our system. Could you confirm it's definitely the right number for you, or pop me the correct one so I can find you?";
  }
  return `Thanks! Just to double-check — that number is already registered on our system. Could you confirm it's definitely the right number for ${subject}, or pop me the correct one so I can find them?`;
}

export function buildGroupedAskReply(missing: string[]): string {
  if (!missing.length) {
    return "Thanks for all that detail! Let me get this logged for you now.";
  }
  const bullets = missing.map((m) => `- ${m}`).join("\n");
  return `Thanks for that! To help our advisors put together the best options, could you also let me know:\n${bullets}`;
}

// Built server-side from the captured slots — simpler and more robust than
// relying on the model to self-report a summary.
export function buildEnquirySummary(slots: EnquirySlots): string {
  const bits: string[] = [];
  if (slots.holidayType) bits.push(slots.holidayType);
  if (slots.destinations?.length) bits.push(`to ${slots.destinations.join("/")}`);
  else if (slots.countries?.length) bits.push(`to ${slots.countries.join("/")}`);
  if (slots.travelDate) bits.push(`on ${slots.travelDate}`);
  else if (slots.flexibility) bits.push(`(${slots.flexibility})`);
  if (slots.nights) bits.push(`${slots.nights} nights`);
  const pax = [slots.adults ? `${slots.adults} adults` : null, slots.children ? `${slots.children} children` : null]
    .filter(Boolean)
    .join(", ");
  if (pax) bits.push(pax);
  if (slots.budget) bits.push(`budget £${slots.budget}${slots.budgetType ? ` (${slots.budgetType})` : ""}`);
  // NOTE: the customer's free-text `slots.notes` is intentionally NOT included
  // here — the enquiry note builder adds it as its own line, so including it
  // in the summary too would duplicate it.
  return bits.length ? `Enquiry from conversation: ${bits.join(", ")}.` : "Enquiry captured from conversation.";
}

// Best-effort extraction of the date/time the customer says they're available
// for a callback, in Europe/London terms. Returns null if nothing usable was
// stated (the task is still created — just with no due date).
export async function parseAvailabilityTime(text: string): Promise<Date | null> {
  const now = new Date();
  let raw: string | undefined;
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: UTILITY_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content:
            `The current UTC date/time is ${now.toISOString()}. The customer is in the UK (Europe/London timezone). ` +
            "Extract the specific date and time they say they're available for a callback from their message. " +
            "Always resolve to the NEXT future occurrence (never in the past). If they gave only a time with no date, assume today if that time is still ahead in UK time, otherwise tomorrow. " +
            "If they gave only a day with no time, use 10:00 UK time. If no usable date/time can be determined at all, return null. " +
            'Respond ONLY with JSON: {"iso": string | null} where iso is a full ISO 8601 UTC datetime, e.g. "2026-07-13T14:00:00.000Z".',
        },
        { role: "user", content: text },
      ],
    });
    logAiUsage("availabilityParse", UTILITY_MODEL, response.usage);
    raw = response.choices[0]?.message?.content?.trim();
  } catch (err) {
    console.error("[ai-conversation.brain] parseAvailabilityTime OpenAI call failed:", err instanceof Error ? err.message : err);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { iso?: string | null };
    if (!parsed.iso) return null;
    const d = new Date(parsed.iso);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
