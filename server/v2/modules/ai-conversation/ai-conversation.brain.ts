import OpenAI from "openai";
import { CHAT_MODEL } from "../../utils/ai-model";
import type { NeonClient, OrgBotConfig, OrgKnowledgeBase } from "@shared/schema";
import type { AiTurn, EnquirySlots, RetrievedContext, RetrievedMatch, TranscriptMessage } from "./ai-conversation.types";

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
export function buildRulesBlock(rules: BotRule[], bot: BotAudience): string | null {
  const filtered = rules.filter((r) => audienceAllows(r.audience, bot) && r.isActive !== false);
  if (!filtered.length) return null;
  return "Additional rules you MUST follow (set by the agency):\n" + filtered.map((r) => `- ${r.text}`).join("\n");
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
// existing booking, NOT a new sales lead.
const ADMIN_COMPLAINT_RE = /\b(?:complain\w*|refund)\b/i;
export function looksLikeAdminAsk(text: string): boolean {
  const t = text || "";
  return ADMIN_ASK_RE.test(t) || ADMIN_PROVIDING_RE.test(t) || ADMIN_COMPLAINT_RE.test(t);
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
): Promise<string> {
  const fallback =
    kind === "ask_callback_time"
      ? "Thanks — I've logged that for you! What time works best for a quick call so we can go through the details?"
      : "Perfect, that's booked in — one of our advisors will call you then. Speak soon!";

  const time = statedTime?.trim();
  const instruction =
    kind === "ask_callback_time"
      ? "The customer's holiday enquiry has just been logged and is being passed to one of the team to look into. Write ONE short, warm message that (a) reassures them you've noted it and the team will get on it, and (b) asks what time would suit them for a quick call to go through the details. Do NOT ask for any more holiday details. Reply with the message text ONLY."
      : `The customer has just told you when they're free for a call${time ? `, in their own words: "${time}"` : ""}. Write ONE short, warm message confirming that one of the team will give them a call then. Reflect their stated time naturally in your own words (e.g. "anytime today" → "we'll give you a call at some point today"; "after 5pm tomorrow" → "we'll call you after 5 tomorrow") — do NOT use the vague robotic phrase "at that time". End with a friendly sign-off. Reply with the message text ONLY.`;

  try {
    const parts: string[] = [
      `You are ${botConfig?.name?.trim() || "a friendly UK travel agent"} continuing an ongoing chat with a customer for a UK travel agency — do NOT greet them again or open with "hi"/"hey there"/"thanks for reaching out"; just carry on naturally.`,
      "Use UK English. Write in the warm, natural, conversational voice of a friendly UK high-street travel agent — relaxed and human, never robotic, corporate, stiff, or formulaic.",
    ];
    if (botConfig?.persona?.trim()) parts.push(`Tone: ${botConfig.persona.trim()}`);
    const styleBlock = buildStyleExamplesBlock(kb, "Match the tone, warmth and phrasing of these example conversations:");
    if (styleBlock) parts.push(styleBlock);
    parts.push(instruction);

    const res = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.7,
      messages: [{ role: "system", content: parts.join("\n\n") }],
    });
    return res.choices[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

// The "grouped follow-up" (ask for the still-missing enquiry fields in one go)
// was a fixed bullet-list template, which reads like a form. Generate it in the
// house voice instead — conversational, not a list — while still covering the
// same missing fields. Falls back to the fixed template on any failure.
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
    parts.push(
      "Ask the customer for only the ONE (at most TWO, and only if they naturally go together) most useful detail still needed to find them a good deal, in one or two short warm sentences. Do NOT stack several separate questions into one message or make it read like a list/form. " +
        "CRUCIAL: read what they have ALREADY told you above and do NOT re-ask anything they've answered or said they have no preference on — e.g. if they said they're open to suggestions or just want 'somewhere hot near the beach', that IS their destination answer, so do NOT ask where they want to go. " +
        "Prioritise, in order: the destination (ONLY if they have not named one AND have not said they're flexible/open to suggestions), travel dates, number of nights, budget, then board basis. " +
        "These are the fields still marked missing (use as a guide, but the conversation above is the source of truth for what they've already said): " +
        `${missingFields.join(", ")}. Reply with the message text ONLY.`,
    );
    const res = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.7,
      messages: [{ role: "system", content: parts.join("\n\n") }],
    });
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

  // Client onboarding gate: collect details before anything else for unknown contacts.
  // Only a full name and phone number are required — we do NOT ask for email.
  if (!knownClient) {
    parts.push(
      [
        "IMPORTANT — this customer is NOT on our system yet. Your FIRST reply must do TWO things in one short, friendly message:",
        "  1. Briefly acknowledge their message in a natural, friendly way so they know you've understood what they asked — the way a warm UK travel agent would reassure them you can help. VARY your wording naturally to fit their message; do NOT open with a canned phrase like \"Of course\". Keep it to a line, and do NOT start answering the enquiry or asking holiday details yet.",
        "  2. Then ask for their FULL NAME and PHONE NUMBER so you can check them on the system — phrase it naturally and casually in the message, e.g. \"can you pop me your full name and phone number so I can check you're on the system?\". Do NOT ask for an email address, and do NOT use stiff phrasing like \"set up your file\".",
        "- On every reply after that, look at what they have already given and ask ONLY for what is still missing — e.g. if they gave just their name, ask for their phone number only. NEVER re-ask for a detail they have already provided.",
        "- Put whatever they provide into `client`: { fullName, phone } — leave a field as an empty string until they actually give it.",
        "Only once you have BOTH their full name and phone, give a brief confirmation that you can see them on the system (e.g. \"That's great, I can see you on the system\"), then respond to WHAT THEY ACTUALLY ASKED FOR: if they've already shown they want a holiday, carry on helping with that; if they only greeted you or haven't said what they need, ask an OPEN, friendly question about how you can help (e.g. \"what can I help you with today?\") — do NOT assume they want to book, and do NOT start asking for destination, dates, or who's travelling. Do not start collecting holiday enquiry details until you have their full name and phone AND they've actually expressed interest in a holiday.",
      ].join("\n"),
    );
  }
  if (botConfig?.persona?.trim()) parts.push(`Persona: ${botConfig.persona.trim()}`);
  if (botConfig?.preferredResponse?.trim()) parts.push(`How to respond: ${botConfig.preferredResponse.trim()}`);
  if (botConfig?.greeting?.trim()) parts.push(`Greeting style: ${botConfig.greeting.trim()}`);
  if (botConfig?.signOff?.trim()) parts.push(`Sign-off: ${botConfig.signOff.trim()}`);
  if (botConfig?.language?.trim()) parts.push(`Reply in: ${botConfig.language.trim()}`);

  const rulesBlock = buildRulesBlock(parseBotRules(botConfig?.rules), "sales");
  if (rulesBlock) parts.push(rulesBlock);

  parts.push(
    "Never quote firm prices, availability, or confirm bookings you cannot verify — instead gather the enquiry and let a human advisor follow up.",
  );

  const handoff = [
    "Set hand_off=true ONLY if the customer explicitly asks for a human/agent, is clearly upset or complaining, or makes a request genuinely unrelated to booking a holiday.",
    "NEVER hand off just because an enquiry looks already logged, repeated, or previously mentioned, or because you've said 'an advisor will get back' before — a repeated or restated holiday interest is NOT a hand-off reason; help with it as a normal enquiry.",
    botConfig?.handoffInstructions?.trim() || "",
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(handoff);

  // Company info: static KB rows plus any vector-retrieved KB matches (Phase 5d),
  // folded into the same block and capped together at KB_CHAR_BUDGET.
  const activeKb = kb.filter((k) => k.isActive && audienceAllows(k.audience, "sales"));
  const factKb = activeKb.filter((k) => !isStyleExampleCategory(k.category));
  const retrievedKb = (retrieved?.kb ?? []).filter(
    (m) => !isStyleExampleCategory(retrievedMatchCategory(m)) && audienceAllows(retrievedMatchAudience(m), "sales"),
  );
  const kbLines = [...factKb.map((k) => `- ${k.title}: ${k.content}`), ...retrievedKb.map((m) => `- ${m.content}`)];
  if (kbLines.length) {
    let company = kbLines.join("\n");
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

  if (client) {
    parts.push(`You are speaking with ${[client.title, client.firstName, client.surename].filter(Boolean).join(" ")}.`);
  }

  // Enquiry slot-filling instructions (§14). There is NO confirmation gate —
  // the worker (in code) sends one grouped follow-up for whatever is missing,
  // then creates the enquiry on the customer's next reply regardless of gaps.
  parts.push(
    [
      "If the customer is enquiring about a holiday, capture it conversationally — do NOT wait for the customer to confirm before it can be logged, and do NOT insist on collecting every field before you can help further.",
      "- DO NOT ASSUME THE CUSTOMER WANTS TO BOOK. If they have only greeted you (e.g. \"hi\", \"hi ai\"), made small talk, or not yet said what they want, do NOT ask for destination, dates, nights, budget, or who's travelling — greet them warmly and ask ONE open question about how you can help. Only start collecting holiday details ONCE they've actually expressed interest in a trip/holiday; until then set intent=\"other\".",
      "- CRITICAL: Only record details the customer has ACTUALLY stated in this conversation. Never invent, guess, infer or pad out destinations, board basis, star ratings, budgets or any other value they did not say. Do not repeat a value multiple times. If unsure, leave it empty.",
      "- The 'Current enquiry status' and 'Known enquiry details' provided below are the AUTHORITATIVE source of what's already captured. Earlier messages in the transcript may show a PREVIOUS enquiry that was already logged — do NOT say things like 'we already have your enquiry' or refuse to help based on them. If the current status is none/collecting and the customer shows holiday interest, treat it as a brand-new enquiry and collect it from scratch.",
      '- Classify the holiday type into one of: "Package Holiday" (default), "Cruise Package", "Hot Tub Break".',
      '- `boardBasis` (only if they mentioned meals/board) must use these exact values: "All Inclusive", "Bed and Breakfast", "Self Catering", "Half Board", "Full Board", "Room Only". `starRating` (only if they mentioned a hotel star rating) must be one of: "2 Star", "3 Star", "4 Star", "5 Star" — a word like "luxury" is NOT a star rating.',
      "- Collect the fields for the detected holiday type (ask for what's offered, never block on any one field):",
      "   • Package Holiday: destination, resort, departure airport, travel date, number of nights, passengers (adults/children/infants + child ages), board basis, minimum star rating, budget.",
      "   • Hot Tub Break: destination, resort, travel date, number of nights, number of guests, weekend lodge (yes/no), pets (how many), budget.",
      "   • Cruise Package: cruise destination, travel date, number of nights, passengers, cabin type, cruise line, pre-cruise stay nights, post-cruise stay nights, departure airport, budget.",
      "- Extract everything mentioned so far into `slots` (merge with the known details you are given): use fields enquiryTitle, holidayType, countries, destinations, resorts, departureAirports, boardBasis, starRating, travelDate, flexibility, nights, adults, children, infants, childAges, budget, budgetType, cabinType, cruiseLine, preCruiseStay, postCruiseStay, guests, pets, weekendLodge, accommodationType, notes. Leave unknown fields empty.",
      '- DATES: `travelDate` must be a single specific calendar date in YYYY-MM-DD format, and ONLY when the customer gave a specific date. If the customer gives a day/month with no year, assume the NEXT future occurrence (never a past date). If they give a range or vague timing (e.g. "mid to end of August", "New Year", "sometime in summer", "October school holidays", "not sure"), leave `travelDate` empty and record their exact wording in `notes`. Do NOT invent an exact date.',
      '- FLEXIBILITY: always leave `flexibility` EMPTY — do not populate it at all, even for vague timing (that wording goes in `notes` only, per the DATES rule above).',
      '- NIGHTS: put the number of nights in `nights` whenever it is stated or clearly implied — e.g. "4 nights" → 4, "a week" → 7, "10 days" → 10, "a fortnight" → 14, "long weekend" → 3. Leave empty if they haven\'t indicated a length.',
      '- BUDGET: put the amount as digits only in `budget` (no "£", commas or words — e.g. "1100"), and set `budgetType` to exactly "Per Person" or "Package". If they give a range (e.g. "1000-2000"), record the TOP of the range.',
      '- DEPARTURE AIRPORT: whenever the customer says they will "fly from", "flying from", "depart(ing) from", "leave from", or simply "from" a place (e.g. "fly from Newcastle", "from Manchester", "out of Gatwick"), record that airport/city in `departureAirports` as an array (e.g. ["Newcastle"]). This is the airport they leave the UK from — do NOT confuse it with their holiday destination.',
      "- ASKING STYLE (STRICT — this overrides any urge to be thorough or cover everything in one go): every message must be SHORT — at most two sentences — and ask about only ONE thing at a time (or two ONLY if they naturally belong together, e.g. number of adults and children). NEVER stack several separate questions into one reply: do NOT, for example, ask party size AND children's ages AND dates AND airport AND board basis in the same message — pick the single most useful missing detail and ask just that. Prioritise, in order: destination (only if they haven't given one and aren't open to suggestions), then rough dates, then number of nights, then budget; deliberately leave the rest for later messages and pick them up naturally over the next few replies. Never reel off a list, never make it read like a form, and never re-ask a detail they've already given or declined.",
      "- Do NOT offer to arrange a call, a callback, or say a colleague/advisor/the team will be in touch while you are still gathering enquiry details — that step happens later and automatically, so leave it out and just ask the next detail.",
      "- For each field: if they give a value, record it in `slots`. If they say no / none / not sure / no preference / any / doesn't matter, treat that field as ANSWERED — leave it empty, do NOT store it, and never ask about it again.",
      "- If it is not a holiday enquiry, set intent=\"other\" and just answer helpfully.",
      '- If the "Current enquiry status" given below is "awaiting_availability", the customer\'s enquiry has ALREADY been logged and they are now being asked what time suits a callback — just acknowledge their answer helpfully, do not re-collect enquiry details or treat it as a new enquiry.',
    ].join("\n"),
  );

  parts.push(
    'Respond ONLY with JSON: {"hand_off": boolean, "intent": "enquiry"|"other", "slots": object, "client": {"fullName": string, "phone": string}, "reply": string}. `reply` is the message to send the customer; `client` holds any personal details they have given (empty strings if unknown).',
  );
  return parts.join("\n\n");
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
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 700,
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
  const raw = response.choices[0]?.message?.content?.trim();
  const fallback: AiTurn = { hand_off: true, intent: "other", slots: {}, client: {}, reply: FALLBACK_REPLY };
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw) as Partial<AiTurn>;
    return {
      hand_off: !!p.hand_off,
      intent: p.intent === "enquiry" ? "enquiry" : "other",
      slots: (p.slots as EnquirySlots) ?? {},
      client: (p.client as AiTurn["client"]) ?? {},
      reply: (p.reply ?? "").trim() || FALLBACK_REPLY,
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Holiday-type field checklists — used to (a) gate the ONE grouped follow-up
// on a soft anti-empty threshold and (b) compute what's still missing, both
// for the grouped-ask reply and for the "additional fields still needed" note
// written on enquiry creation.
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

// Missing = holiday-type field list − filled slots (used for both the grouped
// follow-up and the "additional fields still needed" note on creation).
export function missingFieldsFor(slots: EnquirySlots): string[] {
  return fieldChecksFor(slots)
    .filter((f) => !f.has(slots))
    .map((f) => f.label);
}

// Soft anti-empty threshold: at least one substantive detail beyond the
// (default) holiday type, so a bare "hi" never starts the grouped-ask/create
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
  const openai = getOpenAI();
  const now = new Date();
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
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
  const raw = response.choices[0]?.message?.content?.trim();
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
