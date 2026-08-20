// Scrubs personal data out of style-example KB entries before they reach a
// model prompt.
//
// WHY THIS EXISTS: style examples are real customer conversations pasted into
// the knowledge base, and buildStyleExamplesBlock injects them VERBATIM into
// every single turn (see ai-conversation.brain.ts). They are there to teach
// tone — nothing about their content is ever meant to reach a customer. But a
// turn that loses its own context (a wiped hand-off, an empty enquiry) leaves
// the model with these transcripts as the nearest complete example of "a
// message from us", and it has copied a name straight out of one — greeting a
// customer by a DIFFERENT customer's name. Prompt instructions alone did not
// hold under that pressure, so the data itself is removed instead: tone is
// carried entirely by phrasing and rhythm, so redacting identifiers costs the
// examples nothing they are actually used for.
//
// Applied at READ time rather than on save, deliberately: it protects every
// entry already in the database without a migration, covers the internal
// assistant and the Test AI sandbox through the same call, and cannot be
// bypassed by a row written some other way. It is pure and deterministic, so
// the static prompt prefix stays byte-identical across turns and prompt
// caching is unaffected.

/** Every person is "Team" — the same word the bot is told to use instead of
 *  naming a colleague, so an example can only ever model the right habit.
 *  Contact details keep bracketed placeholders: those redact a value, they are
 *  not a way of referring to someone. */
const TEAM = "Team";
const PHONE = "[phone number]";
const EMAIL = "[email]";
const POSTCODE = "[postcode]";

// Capitalised words that follow a greeting or a "this is …" but are NOT names.
// Without this, "Hi Tuesday" is fine but "Thanks Disneyland" and "Hi All" would
// be redacted into nonsense, and the examples would stop reading as English.
const NOT_A_NAME = new Set(
  [
    // Address-a-group, roles, and the words our own team uses about itself.
    "all", "team", "everyone", "guys", "both", "there", "again", "you", "your",
    "customer", "client", "agent", "advisor", "adviser", "admin", "support",
    "sales", "reception", "office", "manager", "me", "us", "we", "i",
    // Sentence starters that can legitimately follow a comma after "thanks".
    "and", "but", "so", "just", "yes", "no", "ok", "okay", "sorry", "please",
    "that", "this", "these", "those", "it", "its", "the", "a", "an", "for",
    "have", "hope", "happy", "great", "lovely", "perfect", "brilliant",
    "i", "i'll", "i've", "i'm", "we", "we'll", "you'll", "he", "she", "they",
    "that's", "there's", "here", "how", "what", "when", "where", "will", "can",
    // Days and months — extremely common right after "thanks" / "speak to you".
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
    // Travel vocabulary that is capitalised often enough to matter.
    "holiday", "flight", "flights", "hotel", "hotels", "resort", "booking",
    "deal", "deals", "offer", "offers", "quote", "package", "trip",
  ].map((w) => w.toLowerCase()),
);

/** True when a capitalised token is a plausible personal name rather than an
 *  ordinary capitalised word. Length-bounded so it can't swallow a sentence. */
function looksLikeName(token: string): boolean {
  if (token.length < 2 || token.length > 20) return false;
  return !NOT_A_NAME.has(token.toLowerCase().replace(/’/g, "'"));
}

// Openers and closers that put a NAME in the very next position. This is the
// exact shape of the leak we saw — "Hi Shannon" — so it is the highest-value
// rule here, and it is safe because the vocative slot is one of the few places
// a capitalised word is almost always a name.
const VOCATIVE_RE =
  /\b([Hh]i|[Hh]iya|[Hh]ello|[Hh]ey|[Hh]eya|[Mm]orning|[Aa]fternoon|[Ee]vening|[Tt]hanks|[Tt]hank you|[Cc]heers|[Bb]ye|[Gg]oodbye|[Dd]ear|[Ww]elcome back|[Ww]elcome)\b([,!]?\s+)([A-Z][a-z'’-]{1,19})(\s+[A-Z][a-z'’-]{1,19})?/g;

// Self-introductions, from either side: "my name is Shannon", "this is Lisa".
// Kept narrow — an unanchored "I'm X" matches far too much ordinary prose.
const INTRODUCTION_RE =
  /\b([Mm]y name(?:'s| is)|[Tt]his is|[Ss]peaking to|[Ss]poke to|[Ss]peak to|[Ii]t'?s)\s+([A-Z][a-z'’-]{1,19})(\s+[A-Z][a-z'’-]{1,19})?/g;
// Transcript speaker labels at the start of a line — "Shannon:", "Lisa:".
// Pasted conversations are full of these, and they name both the customer AND
// the colleague who handled it.
const SPEAKER_RE = /^([ \t]*)([A-Z][a-z'’-]{1,19})(\s*:)/gm;

// Contact details. Phone deliberately demands 10+ digits and refuses a leading
// currency symbol, so it can never eat a price like "£1,299.00" — prices are
// part of the tone we want the examples to keep teaching.
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?<![£$€\d.,])(?:\+?\d[\d\s().-]{8,}\d)(?![\d.,]*\d*\s*(?:pp|per person))/g;
const UK_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;

/** Count the digits in a matched run — the phone pattern is permissive about
 *  separators, so the real test is how many digits it actually contains. */
function digitCount(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

/** The optional second capitalised word after a name. Dropped when it reads
 *  like a surname, preserved verbatim when it is ordinary prose. */
function keptTail(second: string | undefined): string {
  if (!second) return "";
  return looksLikeName(second.trim()) ? "" : second;
}

export interface AnonymiseOptions {
  /** Literal names to redact wherever they appear, whatever the position.
   *  For the ones the positional rules cannot reach — a colleague named
   *  mid-sentence, a customer referred to in the third person. */
  extraNames?: string[];
}

/** Escape a literal for safe use inside a RegExp. */
function escapeLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove personal identifiers from one style-example body.
 *
 * Redacts: contact details (email, phone, UK postcode) and personal names in
 * the positions that actually carry them (vocative, self-introduction,
 * transcript speaker label), plus any literal names supplied by the caller.
 * A name becomes "Team", except in a greeting where it is dropped outright
 * so the line still reads like something a person would actually send.
 *
 * Deliberately KEEPS: prices, dates, destinations, hotel names, board basis,
 * and every word of the phrasing itself. Those are what the examples teach,
 * they are not personal data on their own, and the prompt already forbids
 * treating them as this customer's.
 */
export function anonymiseStyleExample(text: string, opts?: AnonymiseOptions): string {
  if (!text) return text;
  let out = text;

  // Contact details first — they are unambiguous, and clearing them stops a
  // digit run from confusing the name rules that follow.
  out = out.replace(EMAIL_RE, EMAIL);
  out = out.replace(PHONE_RE, (m) => (digitCount(m) >= 10 ? PHONE : m));
  out = out.replace(UK_POSTCODE_RE, POSTCODE);

  // Caller-supplied names, longest first so "Anne Marie" is consumed before
  // "Anne" can half-match it.
  for (const raw of [...(opts?.extraNames ?? [])].sort((a, b) => b.length - a.length)) {
    const name = raw.trim();
    if (name.length < 2) continue;
    out = out.replace(new RegExp(`\\b${escapeLiteral(name)}\\b`, "gi"), TEAM);
  }

  out = out.replace(SPEAKER_RE, (m, indent: string, token: string, colon: string) =>
    looksLikeName(token) ? `${indent}${TEAM}${colon}` : m,
  );

  out = out.replace(VOCATIVE_RE, (m, lead: string, gap: string, first: string, second?: string) => {
    if (!looksLikeName(first)) return m;
    return `${lead}${keptTail(second)}`;
  });

  out = out.replace(INTRODUCTION_RE, (m, lead: string, first: string, second?: string) => {
    if (!looksLikeName(first)) return m;
    return `${lead} ${TEAM}${keptTail(second)}`;
  });

  return out;
}
