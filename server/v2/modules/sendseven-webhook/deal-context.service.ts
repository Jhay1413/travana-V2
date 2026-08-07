// Pinning + hydration of "the Facebook deal this conversation is about".
//
// When a customer messages us about a deal we posted ("the Tunisia holiday on
// the 29th October"), the reply worker vector-searches the posted-deal
// embeddings (ai_embeddings sourceType "deal" — see social-post/deal-embedding.ts)
// and PINS the winning deal on sendseven_conversation_state.context.dealRef.
// Each sales turn the pin is hydrated LIVE from the DB (never trusted from the
// embedding content, which may be stale) into a RetrievedDealContext the brain
// renders as a customer-visible prompt block.

import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import { socialPostRepository } from "../social-post/social-post.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import type {
  EnquirySlots,
  RetrievedContext,
  RetrievedDealContext,
  RetrievedMatch,
} from "../ai-conversation/ai-conversation.types";

// The deal pinned to a conversation, stored on context.dealRef. `source` records
// HOW it was pinned — stronger sources must never be overwritten by weaker ones
// (meta > marker > vector; Phase 3 adds the first two).
export interface DealRef {
  travelDealId: string;
  quoteId: string;
  title: string;
  source: "vector" | "marker" | "meta";
  matchedAt: string;
  distance?: number;
  // Slot keys THIS deal seeded (see seedSlotsFromDeal). Recorded so a re-pin
  // can un-seed them: without this, correcting the pin would leave the wrong
  // deal's date/nights/airport behind, and the new deal (which only fills
  // BLANK slots) could never replace them.
  seededKeys?: string[];
}

// Auto-pin cutoff. Pinning the WRONG deal and confidently quoting its
// hotel/price is worse than not matching at all — but observed distances say
// 0.35 was too strict: a message carrying the deal title VERBATIM plus date
// words scored 0.332, and the title alone scored just over the old bar.
// 0.40 keeps verbatim-title messages pinning; vaguer mentions fall to the
// candidate band below instead of silently missing.
export const DEAL_MATCH_MAX_DISTANCE = 0.4;
// Candidate band: matches in (DEAL_MATCH_MAX_DISTANCE, this] are too vague to
// pin ("i saw a deal for tunisia last night") but plausible enough that the AI
// should ask WHICH post they saw, offering these titles. Retrieval runs with
// this wider cutoff; pickDealMatch re-applies the strict one for pinning.
export const DEAL_CANDIDATE_MAX_DISTANCE = 0.6;
// Matches within this distance of the best one count as a near-tie, resolved
// by recency: two similar "All Inclusive Tunisia" posts should pin the one the
// customer most plausibly just saw.
const NEAR_TIE_DISTANCE = 0.03;

interface DealCandidate {
  travelDealId: string;
  quoteId: string;
  title: string;
  travelDate: string | null;
  price: string | null;
  hotelName: string | null;
  postScheduleMs: number;
  distance: number;
}

function parseCandidate(match: RetrievedMatch): DealCandidate | null {
  const meta = (match.metadata ?? {}) as Record<string, unknown>;
  const travelDealId = typeof meta.travelDealId === "string" ? meta.travelDealId : null;
  const quoteId = typeof meta.quoteId === "string" ? meta.quoteId : null;
  if (!travelDealId || !quoteId) return null;
  const postSchedule = typeof meta.postSchedule === "string" ? Date.parse(meta.postSchedule) : NaN;
  return {
    travelDealId,
    quoteId,
    title: typeof meta.title === "string" ? meta.title : "",
    travelDate: typeof meta.travelDate === "string" ? meta.travelDate : null,
    price: typeof meta.price === "string" ? meta.price : null,
    hotelName: typeof meta.hotelName === "string" ? meta.hotelName : null,
    postScheduleMs: Number.isNaN(postSchedule) ? 0 : postSchedule,
    distance: match.distance,
  };
}

const MONTH_NAMES_LOWER = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  const suffix = ["th", "st", "nd", "rd"][day % 10] ?? "th";
  return `${day}${["st", "nd", "rd"].includes(suffix) ? suffix : "th"}`;
}

// The common ways a deal's travel date gets written in a message or appears in
// a screenshot's extracted text: ISO, dd/mm/yyyy, "12 April", "12th April",
// "April 12". All lowercase — callers compare against a lowercased query.
function dateVariants(iso: string): string[] {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [];
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  const monthName = MONTH_NAMES_LOWER[month];
  const dd = String(day).padStart(2, "0");
  const mm = String(month + 1).padStart(2, "0");
  return [
    d.toISOString().slice(0, 10),
    `${dd}/${mm}/${year}`,
    `${day}/${month + 1}/${year}`,
    `${day} ${monthName}`,
    `${ordinal(day)} ${monthName}`,
    `${monthName} ${day}`,
  ];
}

// The deal's posted price appearing as a standalone number ("£369", "369.00",
// "from 369") — digit-boundary guarded so phone numbers/references can't hit.
function priceAppearsIn(q: string, price: string): boolean {
  const whole = price.replace(/[^\d.]/g, "").split(".")[0];
  if (whole.length < 2) return false;
  return new RegExp(`(?<!\\d)${whole}(?:\\.\\d{2})?(?!\\d)`).test(q);
}

// Evidence the customer is referring to something they SAW (a post, an advert,
// an image they've sent), rather than just stating their own travel plans.
// Gates the date/price rescue below: "we want Rome on 12 April" happens to
// contain a deal's exact travel date, but pinning that deal — and quoting its
// hotel and price at someone who never saw the advert — is presumptuous.
// "DEAL" ON ITS OWN IS NOT EVIDENCE. This gate is the ONLY thing stopping
// similarity from pinning one of our posts to a customer who never saw one —
// and it used to match the bare words deal/deals/offer/offers/ad/ads. So
// "Hiya are u doing deals for ac Milan flights and hotels?" read as "I saw one
// of your posts", similarity was let loose on a generic flights-and-hotels
// query, and an unrelated Marhaba Royal deal got pinned and named back to the
// customer. Those words are ordinary commercial English ("do you do deals
// for…", "any offers?") and carry no evidence at all.
//
// So they now count ONLY when a determiner points at something specific —
// "your deal", "this offer", "the deal you posted". Words that ARE evidential
// on their own (saw/seen/spotted, post, advert, screenshot, facebook, insta,
// story, reel, page) are unchanged, as are picture/photo/image, which the
// image-details note relies on to signal a screenshot the customer sent.
const POST_REFERENCE_RE =
  /\b(?:saw|seen|spotted|post|posted|posting|advert|advertisement|facebook|fb|insta|instagram|social|screenshot|picture|photo|image|story|reel|page)\b|\b(?:your|ur|this|that|the|these|those)\s+(?:deals?|offers?|ads?)\b|\b(?:deals?|offers?|ads?)\s+(?:you|u|yous)\s+(?:posted|shared|advertised|put\s+up)\b/i;

// "yes", "yeah that's the one", "correct" — enough to accept a confirmation of
// a guessed deal. Deliberately narrow: anything else leaves the deal
// unconfirmed, which is the safe state.
const AFFIRMATIVE_RE =
  /^\s*(?:yes|yeah|yep|yh|yea|aye|correct|that'?s? (?:the one|right|it)|thats (?:the one|right|it)|it is|please|ok(?:ay)?)\b/i;

export function isAffirmative(text: string): boolean {
  return AFFIRMATIVE_RE.test(text ?? "");
}

export function hasPostReferenceSignal(text: string): boolean {
  return POST_REFERENCE_RE.test(text ?? "");
}

// Other travel brands a customer may name as the SOURCE of the deal they saw
// ("saw this on TUI", a Jet2 screenshot). We sell some of these as operators,
// so the brand alone means nothing — it's the brand as the PLACE they saw it
// that matters, which is why the ownership cue below overrides it.
// Spaces are optional throughout so the bare domain form matches too — a
// screenshot's footer says "firstchoice.co.uk", not "First Choice".
const EXTERNAL_BRAND_RE =
  /\b(tui|jet ?2|easy ?jet|on ?the ?beach|love ?holidays|expedia|booking\.com|last ?minute|travel ?republic|thomas ?cook|first ?choice|hays ?travel|virgin ?holidays|british ?airways|ba holidays|ryanair|wizz ?air|sky ?scanner|trivago|kayak|trip ?advisor|secret ?escapes|travel ?zoo|ice ?lolly|holiday ?pirates|holiday ?hypermarket|teletext ?holidays|travel ?supermarket|sun ?master|olympic ?holidays|mercury ?holidays|broadway ?travel|centre ?parcs|butlins|haven ?holidays)\b/i;
// Cues that the customer is talking about OUR post after all ("saw your post",
// "on your page") — these win, so "is your TUI deal still on?" still pins.
// A few words are allowed between the possessive and the noun so the brand can
// sit in the middle ("your TUI deal", "your all inclusive offer").
const OURS_CUE_RE =
  /\b(your|yours|you)\s+(?:[\w'-]+\s+){0,3}(post|posts|posted|page|ad|advert|advertisement|deal|deals|offer|offers|facebook|insta|instagram|story|site|website)\b/i;

// "can you beat this?", "price match?" — asking us to beat or match a price is
// itself proof the quote is someone else's; nobody asks us to undercut our own
// advert. Far more robust than brand-spotting, which a typo defeats (observed:
// "can you bet this one from tin?" — both "beat" and "TUI" misspelt). Hence
// "bet"/"beet" are accepted as the near-universal typo for "beat", but only
// right after "can/could/will you", never as bare words.
const PRICE_MATCH_RE =
  /\b(?:can|could|will|would|do|any chance)\s+(?:you|u|ya|yous)\s+(?:[\w'-]+\s+){0,2}(beat|bet|beet|match|undercut)\b|\bprice[- ]?match\b|\b(beat|match)\s+(this|that|it|these|them|the price|their price|this price|this quote|that quote)\b/i;

/** True when the customer is pointing at ANOTHER company's quote rather than
 *  one of our posts — either they named the company, or they asked us to beat
 *  or match it. Suppresses deal pinning and candidate offers: matching their
 *  TUI screenshot to a similar deal of ours and then quoting our hotel and
 *  price as if it were the one they saw would be plainly wrong. They can still
 *  be helped — it just becomes an ordinary enquiry.
 *
 *  An explicit reference to US always wins ("saw your Rome deal, can you beat
 *  £369?" is our deal plus a discount request, not a rival quote). */
export function mentionsExternalSource(text: string): boolean {
  const t = text ?? "";
  if (!EXTERNAL_BRAND_RE.test(t) && !PRICE_MATCH_RE.test(t)) return false;
  return !OURS_CUE_RE.test(t);
}

// A distinctive fact from the post appearing verbatim in the query: the hotel
// name, or (only with a post reference — see above) the exact travel date or
// posted price. A hotel name is not something a customer says by accident, so
// it needs no gate; a date or a price very much is. Nights deliberately
// excluded entirely — "4 nights" is shared by too many deals to identify one.
function strongSignalHit(c: DealCandidate, q: string, postSignal: boolean): boolean {
  if (postSignal && c.price && priceAppearsIn(q, c.price)) return true;
  if (postSignal && c.travelDate && dateVariants(c.travelDate).some((v) => q.includes(v))) return true;
  if (c.hotelName) {
    const h = c.hotelName.trim().toLowerCase().replace(/\s+/g, " ");
    // Also match without a leading "Hotel " so "the taormina" hits "Hotel
    // Taormina". Length floor keeps generic short names from over-matching.
    const core = h.replace(/^hotel\s+/, "");
    if ((h.length >= 5 && q.includes(h)) || (core.length >= 5 && core !== h && q.includes(core))) return true;
  }
  return false;
}

const MONTH_PATTERN = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

function isoFrom(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) return null;
  return d.toISOString().slice(0, 10);
}

/** Explicit calendar dates in the text, as yyyy-mm-dd — "14/10/2026",
 *  "2026-10-14", "14 Oct 2026", "14th October 2026", "October 14 2026".
 *
 *  A four-digit YEAR is required on purpose. A bare "12 April" is routinely
 *  the customer's OWN preference ("saw your Rome deal — can we go 12 April
 *  instead?"), whereas a full dated line is what a screenshot's extracted text
 *  carries ("Wed 14 Oct 2026"). Only the latter is safe to treat as a fact
 *  about which post they're holding. */
export function explicitDatesIn(text: string): Set<string> {
  const q = (text ?? "").toLowerCase();
  const out = new Set<string>();
  const add = (iso: string | null) => {
    if (iso) out.add(iso);
  };

  for (const m of q.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    add(isoFrom(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // dd/mm/yyyy (UK order — the format our own notes and adverts use).
  for (const m of q.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    add(isoFrom(Number(m[3]), Number(m[2]), Number(m[1])));
  }
  for (const m of q.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})[a-z]*\\.?,?\\s+(\\d{4})\\b`, "g"))) {
    add(isoFrom(Number(m[3]), MONTH_NAMES_LOWER.findIndex((n) => n.startsWith(m[2])) + 1, Number(m[1])));
  }
  for (const m of q.matchAll(new RegExp(`\\b(${MONTH_PATTERN})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "g"))) {
    add(isoFrom(Number(m[3]), MONTH_NAMES_LOWER.findIndex((n) => n.startsWith(m[1])) + 1, Number(m[2])));
  }
  return out;
}

/** True when the text carries explicit dated facts that this deal CONTRADICTS.
 *
 *  Guards the similarity fallback only. A screenshot of an advert carries its
 *  own travel date, and two of our posts can be near-identical in wording —
 *  observed: a Kos "ALL INCLUSIVE IN GREECE, Wed 14 Oct 2026, £742.50pp"
 *  screenshot pinned a CRETE deal (also Greece, also all-inclusive, also from
 *  Newcastle) dated Apr 2027 at £861pp, and the bot then quoted that hotel and
 *  price to the customer. Similarity cannot tell sibling posts apart; a date
 *  can. When the customer's text states dated facts and none of them is this
 *  deal's travel date, it is not the deal they are looking at. */
export function contradictsStatedDate(candidate: { travelDate: string | null }, queryText: string): boolean {
  if (!candidate.travelDate) return false;
  const stated = explicitDatesIn(queryText);
  if (stated.size === 0) return false;
  const dealDate = new Date(candidate.travelDate);
  if (Number.isNaN(dealDate.getTime())) return false;
  return !stated.has(dealDate.toISOString().slice(0, 10));
}

// Words that carry no identifying weight in a deal title — grammar, plus the
// marketing filler nearly every post uses ("deal", "break", "escape"). Dropping
// them is what lets "Xmas in Amsterdam" be recognised from "the Amsterdam
// Christmas deal", and also stops two differently-named Amsterdam posts both
// reducing to the same single word (the 2-word floor below then rejects them).
const TITLE_STOPWORDS = new Set([
  "a", "an", "the", "in", "at", "on", "to", "for", "of", "with", "and", "our", "your", "from", "this",
  "deal", "deals", "offer", "offers", "holiday", "holidays", "break", "breaks", "getaway", "getaways",
  "escape", "escapes", "trip", "trips", "special", "specials",
]);

// Same word, different spelling — customers and marketers rarely agree.
const TITLE_SYNONYMS: Record<string, string> = {
  xmas: "christmas",
  crimbo: "christmas",
  ny: "newyear",
  nye: "newyear",
  "all-inclusive": "allinclusive",
};

function normaliseForTitleMatch(text: string): string {
  return (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleTokens(normalised: string): string[] {
  return normalised
    .split(" ")
    .map((w) => TITLE_SYNONYMS[w] ?? w)
    .filter((w) => w.length > 1 && !TITLE_STOPWORDS.has(w));
}

// `source` records HOW the deal was identified, and the difference matters
// downstream: "marker" means the customer gave something that identifies it (a
// title, a hotel, an exact date or price) and it can be spoken about as fact;
// "vector" means it is the closest guess and must be CONFIRMED before any of
// its details are quoted.
function toDealRef(winner: DealCandidate, source: DealRef["source"] = "vector"): DealRef {
  return {
    travelDealId: winner.travelDealId,
    quoteId: winner.quoteId,
    title: winner.title,
    source,
    matchedAt: new Date().toISOString(),
    distance: winner.distance,
  };
}

/** Pick the deal to pin from vector matches.
 *
 *  1. TITLE RESCUE (deterministic, beats distance): if exactly ONE deal's full
 *     title appears verbatim (case-insensitive) in the query text — the
 *     customer named it, or a screenshot's extracted text contains it — that
 *     IS the deal. Distance ranking is unreliable between sibling posts
 *     (observed: a "Spring Time in Rome" screenshot scored 0.461, ranked
 *     BEHIND "Late Rome Deal"@0.443); a verbatim title is not.
 *  2. Otherwise only matches within the strict pin cutoff qualify (retrieval
 *     runs at the wider candidate cutoff); closest wins, near-ties resolved
 *     by most recent post. */
/** The DETERMINISTIC half of the matcher — an identifying fact the customer
 *  actually typed (or a screenshot carried), never a similarity guess:
 *
 *  1. TITLE RESCUE: exactly ONE deal's full title appears verbatim in the
 *     text. Distance ranking is unreliable between sibling posts (observed: a
 *     "Spring Time in Rome" screenshot scored 0.461, ranked BEHIND "Late Rome
 *     Deal"@0.443); a verbatim title is not.
 *  2. FIELD RESCUE: exactly one deal's hotel — or, when the message references
 *     a post/advert/image at all, its exact travel date or posted price.
 *
 *  Returns null when nothing matches or when several deals tie (ambiguous →
 *  ask the customer). This is also the ONLY thing allowed to REPLACE an
 *  existing pin: see resolveDealTurn. */
export function pickDeterministicDealMatch(matches: RetrievedMatch[], queryText?: string): DealRef | null {
  if (!queryText?.trim()) return null;
  const all = matches.map(parseCandidate).filter((c): c is DealCandidate => c !== null);
  if (all.length === 0) return null;

  const q = normaliseForTitleMatch(queryText);
  const titleHits = all.filter((c) => {
    const t = normaliseForTitleMatch(c.title);
    // A title identifies a deal only if it carries at least TWO distinctive
    // words. One ("Amsterdam") would claim every message mentioning the place,
    // and a title of pure filler ("Holiday Deal") identifies nothing at all —
    // plenty of posts share it.
    const wanted = titleTokens(t);
    if (wanted.length < 2) return false;
    if (q.includes(t)) return true;
    // Customers rarely quote a title exactly: our "Xmas in Amsterdam" post was
    // asked about as "the Amsterdam Christmas deal", which shares every
    // meaningful word but matches no substring. So also accept a title whose
    // distinctive words ALL appear in the message, in any order.
    const present = new Set(titleTokens(q));
    return wanted.every((w) => present.has(w));
  });
  if (new Set(titleHits.map((c) => c.travelDealId)).size === 1) {
    return toDealRef([...titleHits].sort((a, b) => a.distance - b.distance)[0], "marker");
  }

  const postSignal = hasPostReferenceSignal(queryText);
  const fieldHits = all.filter((c) => strongSignalHit(c, q, postSignal));
  if (new Set(fieldHits.map((c) => c.travelDealId)).size === 1) {
    return toDealRef([...fieldHits].sort((a, b) => a.distance - b.distance)[0], "marker");
  }
  return null;
}

/** Pick the deal to pin: a deterministic match if there is one, otherwise the
 *  closest vector match within the strict pin cutoff (retrieval itself runs at
 *  the wider candidate cutoff), near-ties resolved by most recent post. */
export function pickDealMatch(matches: RetrievedMatch[], queryText?: string): DealRef | null {
  const deterministic = pickDeterministicDealMatch(matches, queryText);
  if (deterministic) return deterministic;

  // Similarity alone must NEVER pin a deal to a customer who has not indicated
  // they saw one. Naming a destination we happen to advertise is not a
  // reference to the advert — observed: "Looking for a holiday to Albufeira
  // next August near a beach please" pinned our "Albufeira Summer Break" post
  // and stamped its JUNE flight date onto an enquiry that asked for August.
  // Semantic distance cannot tell "I want to go to X" from "I saw your X
  // deal"; the customer's own wording (or an image they sent) can. The
  // DETERMINISTIC path above is exempt — a verbatim deal title or hotel name
  // is direct evidence they mean that specific deal, however they phrase it.
  if (!hasPostReferenceSignal(queryText ?? "")) return null;

  const all = matches.map(parseCandidate).filter((c): c is DealCandidate => c !== null);
  const candidates = all
    .filter((c) => c.distance <= DEAL_MATCH_MAX_DISTANCE)
    // Never let SIMILARITY alone pin a deal whose travel date the customer's
    // own text contradicts — see contradictsStatedDate. Deliberately applied
    // here and not to the deterministic path above: a verbatim title or hotel
    // name is stronger evidence than a date mismatch.
    .filter((c) => !contradictsStatedDate(c, queryText ?? ""));
  if (candidates.length === 0) return null;
  const best = Math.min(...candidates.map((c) => c.distance));
  const winner = candidates
    .filter((c) => c.distance - best <= NEAR_TIE_DISTANCE)
    .sort((a, b) => b.postScheduleMs - a.postScheduleMs)[0];
  return toDealRef(winner);
}

// What the candidates prompt block shows per possible deal — enough for the
// customer to recognise which post they saw (title/date/nights/price), pulled
// from embedding metadata so no DB hit happens before a real pin.
export interface DealCandidateInfo {
  title: string;
  travelDate?: string | null;
  nights?: number | null;
  price?: string | null;
  hotelName?: string | null;
  distance: number;
}

/** The possible-but-unconfirmed deals to offer when nothing pinned: every
 *  parseable match (retrieval already capped at DEAL_CANDIDATE_MAX_DISTANCE),
 *  closest first, deduped by deal. Call only when pickDealMatch returned null. */
export function pickDealCandidates(matches: RetrievedMatch[], limit = 3, queryText?: string): DealCandidateInfo[] {
  const seen = new Set<string>();
  const out: DealCandidateInfo[] = [];
  for (const match of [...matches].sort((a, b) => a.distance - b.distance)) {
    const c = parseCandidate(match);
    if (!c || seen.has(c.travelDealId)) continue;
    // Don't even ask "was it this one?" about a deal the customer's own dated
    // facts rule out — offering the Crete post to someone holding the Kos one
    // is noise at best and misleading at worst.
    if (queryText && contradictsStatedDate(c, queryText)) continue;
    seen.add(c.travelDealId);
    const meta = (match.metadata ?? {}) as Record<string, unknown>;
    out.push({
      title: c.title,
      travelDate: typeof meta.travelDate === "string" ? meta.travelDate : null,
      nights: typeof meta.nights === "number" ? meta.nights : null,
      price: typeof meta.price === "string" ? meta.price : null,
      hotelName: c.hotelName,
      distance: c.distance,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// "2027-04-12T07:05:00.000Z" → "12/04/2027 07:05" — UK-format date+time for
// the agent-facing Post reference note.
function ukDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  return `${date} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Pick the deal to pin from vector matches.
 *
 *  1. TITLE RESCUE (deterministic, beats distance): if exactly ONE deal's full
 *     title appears verbatim (case-insensitive) in the query text — the
 *     customer named it, or a screenshot's extracted text contains it — that
 *     IS the deal. Distance ranking is unreliable between sibling posts
 *     (observed: a "Spring Time in Rome" screenshot scored 0.461, ranked
 *     BEHIND "Late Rome Deal"@0.443); a verbatim title is not.
 *  2. Otherwise only matches within the strict pin cutoff qualify (retrieval
 *     runs at the wider candidate cutoff); closest wins, near-ties resolved
 *     by most recent post. */
export function pickDealMatch(matches: RetrievedMatch[], queryText?: string): DealRef | null {
  const all = matches.map(parseCandidate).filter((c): c is DealCandidate => c !== null);
  if (all.length === 0) return null;

  const q = queryText.toLowerCase().replace(/\s+/g, " ");
  const titleHits = all.filter((c) => {
    const t = c.title.trim().toLowerCase().replace(/\s+/g, " ");
    // Very short titles substring-match too easily ("rome" would hit every
    // Rome message) — require some substance before trusting the rescue.
    return t.length >= 6 && q.includes(t);
  });
  if (new Set(titleHits.map((c) => c.travelDealId)).size === 1) {
    return toDealRef([...titleHits].sort((a, b) => a.distance - b.distance)[0]);
  }

  const postSignal = hasPostReferenceSignal(queryText);
  const fieldHits = all.filter((c) => strongSignalHit(c, q, postSignal));
  if (new Set(fieldHits.map((c) => c.travelDealId)).size === 1) {
    return toDealRef([...fieldHits].sort((a, b) => a.distance - b.distance)[0]);
  }
  return null;
}

/** Pick the deal to pin: a deterministic match if there is one, otherwise the
 *  closest vector match within the strict pin cutoff (retrieval itself runs at
 *  the wider candidate cutoff), near-ties resolved by most recent post. */
export function pickDealMatch(matches: RetrievedMatch[], queryText?: string): DealRef | null {
  const deterministic = pickDeterministicDealMatch(matches, queryText);
  if (deterministic) return deterministic;

  const all = matches.map(parseCandidate).filter((c): c is DealCandidate => c !== null);
  const candidates = all.filter((c) => c.distance <= DEAL_MATCH_MAX_DISTANCE);
  if (candidates.length === 0) return null;
  const best = Math.min(...candidates.map((c) => c.distance));
  const winner = candidates
    .filter((c) => c.distance - best <= NEAR_TIE_DISTANCE)
    .sort((a, b) => b.postScheduleMs - a.postScheduleMs)[0];
  return toDealRef(winner);
}

// What the candidates prompt block shows per possible deal — enough for the
// customer to recognise which post they saw (title/date/nights/price), pulled
// from embedding metadata so no DB hit happens before a real pin.
export interface DealCandidateInfo {
  title: string;
  travelDate?: string | null;
  nights?: number | null;
  price?: string | null;
  hotelName?: string | null;
  distance: number;
}

/** The possible-but-unconfirmed deals to offer when nothing pinned: every
 *  parseable match (retrieval already capped at DEAL_CANDIDATE_MAX_DISTANCE),
 *  closest first, deduped by deal. Call only when pickDealMatch returned null. */
export function pickDealCandidates(matches: RetrievedMatch[], limit = 3): DealCandidateInfo[] {
  const seen = new Set<string>();
  const out: DealCandidateInfo[] = [];
  for (const match of [...matches].sort((a, b) => a.distance - b.distance)) {
    const c = parseCandidate(match);
    if (!c || seen.has(c.travelDealId)) continue;
    seen.add(c.travelDealId);
    const meta = (match.metadata ?? {}) as Record<string, unknown>;
    out.push({
      title: c.title,
      travelDate: typeof meta.travelDate === "string" ? meta.travelDate : null,
      nights: typeof meta.nights === "number" ? meta.nights : null,
      price: typeof meta.price === "string" ? meta.price : null,
      hotelName: c.hotelName,
      distance: c.distance,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// "2027-04-12T07:05:00.000Z" → "12/04/2027 07:05" — UK-format date+time for
// the agent-facing Post reference note.
function ukDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  return `${date} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// True for the slot values seedSlotsFromDeal treats as "not yet answered".
function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Deterministically seed the enquiry slots from the pinned deal, IN PLACE.
 *
 *  The prompt tells the model to extract the deal's basics into slots, but the
 *  model is unreliable at copying them (observed: it re-asked nights that the
 *  deal answers, and the created enquiry lacked the deal's departure airport).
 *  Seeding in code makes the deal's facts server-truth: they render as "Known
 *  enquiry details" (so the AI stops re-asking them) and land on the created
 *  enquiry. Only BLANK fields are filled — anything the customer stated
 *  themselves always wins, and later customer corrections still override via
 *  the normal mergeSlots(prior, turn) path. Idempotent, so calling it every
 *  sales turn while a deal is pinned is safe. */
export function seedSlotsFromDeal(slots: EnquirySlots, deal: RetrievedDealContext): string[] {
  const seeded: string[] = [];
  const fill = <K extends keyof EnquirySlots>(key: K, value: EnquirySlots[K] | null | undefined) => {
    if (!isBlank(value) && isBlank(slots[key])) {
      slots[key] = value as EnquirySlots[K];
      seeded.push(key as string);
    }
  };
  fill("enquiryTitle", deal.title);
  fill("destinations", deal.destination ? [deal.destination] : null);
  fill("resorts", deal.resort ? [deal.resort] : null);
  fill("countries", deal.country ? [deal.country] : null);
  fill("travelDate", deal.travelDate);
  fill("nights", deal.nights);
  fill("boardBasis", deal.boardBasis ? [deal.boardBasis] : null);
  fill("departureAirports", deal.departureAirport ? [deal.departureAirport] : null);

  // The agent-facing "Post reference" note: the deal facts that have NO slot
  // of their own — hotel, flight numbers/times, posted price, luggage &
  // transfers — so they reach the created enquiry even though the customer
  // never asked about them in chat. Slot-mapped facts (date/nights/board/
  // airport/destination) are deliberately NOT repeated here; they surface as
  // proper enquiry fields via the seeds above. Dates in UK format. Appended
  // once — the marker guards per-turn duplication.
  const marker = `Post reference: "${deal.title}"`;
  if (!slots.notes?.includes(marker)) {
    const detailLines: string[] = [];
    if (deal.hotelName) detailLines.push(`• Hotel: ${deal.hotelName}`);
    if (deal.price) detailLines.push(`• Posted price: ${deal.price}`);
    for (const f of deal.flights ?? []) {
      const label = f.direction
        ? `${f.direction.charAt(0).toUpperCase()}${f.direction.slice(1)} flight`
        : "Flight";
      const route = f.from && f.to ? `${f.from} → ${f.to}` : f.from || f.to || null;
      const bits = [
        f.flightNumber ? `${label} ${f.flightNumber}` : label,
        route,
        f.departs ? `departs ${ukDateTime(f.departs)}` : null,
        f.arrives ? `arrives ${ukDateTime(f.arrives)}` : null,
      ].filter(Boolean);
      if (bits.length > 1) detailLines.push(`• ${bits.join(", ")}`);
    }
    if (deal.luggageTransfers) detailLines.push(`• Luggage & transfers: ${deal.luggageTransfers}`);
    const dealNote = detailLines.length ? `${marker}\n${detailLines.join("\n")}` : marker;
    slots.notes = slots.notes?.trim() ? `${slots.notes.trim()}\n\n${dealNote}` : dealNote;
  }
  return seeded;
}

/** Undo a previous deal's seeding, IN PLACE — used when the customer corrects
 *  which post they meant. Clears only the slots THAT deal filled (tracked on
 *  the ref, so anything the customer stated themselves is untouched) and drops
 *  its "Post reference" note block. Without this the corrected pin would be
 *  cosmetic: the new deal only fills BLANK slots, so the wrong deal's date,
 *  nights and airport would survive onto the enquiry. */
export function unseedSlotsFromDeal(slots: EnquirySlots, ref: DealRef): void {
  for (const key of ref.seededKeys ?? []) {
    delete (slots as Record<string, unknown>)[key];
  }
  const marker = `Post reference: "${ref.title}"`;
  if (slots.notes?.includes(marker)) {
    // The note is stored as blank-line-separated blocks; drop the whole block
    // that starts with this deal's marker line.
    const kept = slots.notes
      .split(/\n{2,}/)
      .filter((block) => !block.trimStart().startsWith(marker))
      .join("\n\n")
      .trim();
    slots.notes = kept || undefined;
  }
}

export interface DealTurnResolution {
  // Set ONLY when this turn pinned a deal (first pin OR a correction) — the
  // caller persists it onto its conversation context (each driver has its own
  // context store).
  pinnedNow: DealRef | null;
  deal: RetrievedDealContext | null;
  dealCandidates?: RetrievedContext["dealCandidates"];
  // True when this turn REPLACED an existing pin: the caller must also clear
  // its "deal check already asked" flag, since the check is owed again for
  // the newly-identified deal.
  repinned?: boolean;
  // True when the customer referenced ANOTHER operator's advert — no deal was
  // pinned or offered, and the brain is told not to pass any of ours off as
  // the one they saw.
  externalDealMention?: boolean;
}

/** The complete per-turn deal step, shared by BOTH drivers (reply-worker and
 *  internal-chat-testflow) so the live bot and the Test AI sandbox cannot
 *  drift: retrieval at the candidate cutoff (only while unpinned), pinning
 *  (title rescue → field rescue → strict distance), candidate collection,
 *  live hydration, the tweak-check flag, and slot seeding (mutates `slots`).
 *
 *  Drivers differ ONLY in how they assemble `query` (their message stores
 *  differ) and in persisting the returned pin / consuming the tweak check —
 *  both driver-side, both one line. */
export async function resolveDealTurn(input: {
  orgId: string;
  // Log prefix, e.g. "conv=<id>" (live) or "session=<id>" (test flow).
  logLabel: string;
  existingRef?: DealRef;
  checkAsked?: boolean;
  // Sticky verdict from an EARLIER turn of this conversation: they showed us a
  // rival's quote. Later turns ("jhon, 09356162084", "4 adults") carry no brand
  // or price-match wording of their own, so without this the suppression would
  // lapse and a stray similarity match could pin one of our deals onto their
  // competitor enquiry — observed with a firstchoice.co.uk screenshot.
  externalSticky?: boolean;
  query: string;
  slots: EnquirySlots;
}): Promise<DealTurnResolution> {
  const { orgId, logLabel, existingRef, checkAsked, externalSticky, query, slots } = input;
  let ref = existingRef ?? null;
  let pinnedNow: DealRef | null = null;
  let repinned = false;
  let dealCandidates: DealTurnResolution["dealCandidates"];

  const matches = await aiEmbeddingsService.retrieve({
    orgId,
    sourceType: "deal",
    query,
    // Wider than the 3 we ever OFFER as candidates: the deterministic rescues
    // (verbatim title / hotel / exact date / posted price) can only ever fire
    // on a deal that made it into this pool, and an agency posting several
    // near-identical adverts — "all inclusive Greece from Newcastle" in Kos
    // AND Crete — can easily push the RIGHT one past the third slot on
    // similarity while its exact date sits in the customer's screenshot.
    // Ranking is unchanged; only the pool the exact-fact checks can see.
    limit: 10,
    maxDistance: DEAL_CANDIDATE_MAX_DISTANCE,
  });

  // Another operator's advert (named brand, or a screenshot of their page):
  // never pin ours to it and never offer our titles as "was it this one?".
  // Only gates a FIRST pin — an existing pin stands (they may be asking who
  // the operator on our own deal is).
  const external = !ref && (externalSticky || mentionsExternalSource(query));
  if (external) {
    console.log(
      `[deal-context] ${logLabel} external operator referenced${externalSticky ? " (sticky)" : ""} — not pinning any of our deals`,
    );
  }

  if (!ref && !external) {
    const pinned = pickDealMatch(matches, query);
    if (pinned) {
      ref = pinned;
      pinnedNow = pinned;
      console.log(
        `[deal-context] ${logLabel} pinned deal=${pinned.travelDealId} "${pinned.title}" ` +
          `source=${pinned.source} distance=${pinned.distance?.toFixed(3) ?? "n/a"}`,
      );
    } else {
      // Same gate as the similarity pin: never ask "was it one of these posts?"
      // of a customer who never mentioned seeing one — they're just telling us
      // where they want to go.
      const candidates = hasPostReferenceSignal(query) ? pickDealCandidates(matches, 3, query) : [];
      if (candidates.length) {
        dealCandidates = candidates.map(({ distance: _d, ...c }) => c);
        console.log(
          `[deal-context] ${logLabel} deal candidates offered: ` +
            candidates.map((c) => `"${c.title}"@${c.distance.toFixed(3)}`).join(", "),
        );
      }
    }
  } else if (ref && ref.source === "vector" && isAffirmative(query)) {
    // "yes, that's the one" — the customer has confirmed the guess, so it can
    // now be spoken about as fact. Promoted to "marker" (an identifying fact
    // they gave) and persisted via pinnedNow.
    ref = { ...ref, source: "marker" };
    pinnedNow = ref;
    console.log(`[deal-context] ${logLabel} customer confirmed deal=${ref.travelDealId} "${ref.title}"`);
  } else if (ref) {
    // ALREADY PINNED — allow a correction ("no, it was the spring one"), but
    // only from a DETERMINISTIC match: an identifying fact the customer
    // actually gave. Distance must never move an existing pin, or ordinary
    // chatter would drift the conversation onto whichever deal looked closest
    // this turn. Un-seed the old deal first so its date/nights/airport don't
    // survive onto the enquiry (the new deal only fills BLANK slots).
    const corrected = pickDeterministicDealMatch(matches, query);
    if (corrected && corrected.travelDealId !== ref.travelDealId) {
      console.log(
        `[deal-context] ${logLabel} re-pinned deal=${corrected.travelDealId} "${corrected.title}" ` +
          `(was ${ref.travelDealId} "${ref.title}")`,
      );
      unseedSlotsFromDeal(slots, ref);
      ref = corrected;
      pinnedNow = corrected;
      repinned = true;
    }
  }

  // Hydrated fresh every turn (cheap: two small queries) so the AI always
  // quotes CURRENT hotel/flight detail, never the embedding's snapshot.
  const deal = ref ? await hydrateDealReplyContext(ref) : null;
  if (deal && ref) {
    // A corrected pin is a different holiday, so the "as posted or any
    // tweaks?" check is owed again on the new deal.
    deal.tweakCheckPending = repinned || !checkAsked;
    // A similarity guess must be CONFIRMED with the customer before any of its
    // details are spoken as fact — only a match to something they actually
    // said ("marker") is safe to assert. Seeding the enquiry slots waits on
    // that too: an unconfirmed deal's date and airport must not land on the
    // enquiry.
    deal.unconfirmed = ref.source === "vector";
    if (!deal.unconfirmed) {
      const seededKeys = seedSlotsFromDeal(slots, deal);
      if (pinnedNow) pinnedNow.seededKeys = seededKeys;
    }
  }
  return { pinnedNow, deal, dealCandidates, repinned, externalDealMention: external };
}

export interface DealTurnResolution {
  // Set ONLY when this turn pinned a deal (first pin OR a correction) — the
  // caller persists it onto its conversation context (each driver has its own
  // context store).
  pinnedNow: DealRef | null;
  deal: RetrievedDealContext | null;
  dealCandidates?: RetrievedContext["dealCandidates"];
  // True when this turn REPLACED an existing pin: the caller must also clear
  // its "deal check already asked" flag, since the check is owed again for
  // the newly-identified deal.
  repinned?: boolean;
  // True when the customer referenced ANOTHER operator's advert — no deal was
  // pinned or offered, and the brain is told not to pass any of ours off as
  // the one they saw.
  externalDealMention?: boolean;
}

/** The complete per-turn deal step, shared by BOTH drivers (reply-worker and
 *  internal-chat-testflow) so the live bot and the Test AI sandbox cannot
 *  drift: retrieval at the candidate cutoff (only while unpinned), pinning
 *  (title rescue → field rescue → strict distance), candidate collection,
 *  live hydration, the tweak-check flag, and slot seeding (mutates `slots`).
 *
 *  Drivers differ ONLY in how they assemble `query` (their message stores
 *  differ) and in persisting the returned pin / consuming the tweak check —
 *  both driver-side, both one line. */
export async function resolveDealTurn(input: {
  orgId: string;
  // Log prefix, e.g. "conv=<id>" (live) or "session=<id>" (test flow).
  logLabel: string;
  existingRef?: DealRef;
  checkAsked?: boolean;
  // Sticky verdict from an EARLIER turn of this conversation: they showed us a
  // rival's quote. Later turns ("jhon, 09356162084", "4 adults") carry no brand
  // or price-match wording of their own, so without this the suppression would
  // lapse and a stray similarity match could pin one of our deals onto their
  // competitor enquiry — observed with a firstchoice.co.uk screenshot.
  externalSticky?: boolean;
  query: string;
  slots: EnquirySlots;
}): Promise<DealTurnResolution> {
  const { orgId, logLabel, existingRef, checkAsked, externalSticky, query, slots } = input;
  let ref = existingRef ?? null;
  let pinnedNow: DealRef | null = null;
  let repinned = false;
  let dealCandidates: DealTurnResolution["dealCandidates"];

  const matches = await aiEmbeddingsService.retrieve({
    orgId,
    sourceType: "deal",
    query,
    limit: 3,
    maxDistance: DEAL_CANDIDATE_MAX_DISTANCE,
  });

  // Another operator's advert (named brand, or a screenshot of their page):
  // never pin ours to it and never offer our titles as "was it this one?".
  // Only gates a FIRST pin — an existing pin stands (they may be asking who
  // the operator on our own deal is).
  const external = !ref && (externalSticky || mentionsExternalSource(query));
  if (external) {
    console.log(
      `[deal-context] ${logLabel} external operator referenced${externalSticky ? " (sticky)" : ""} — not pinning any of our deals`,
    );
  }

  if (!ref && !external) {
    const pinned = pickDealMatch(matches, query);
    if (pinned) {
      ref = pinned;
      pinnedNow = pinned;
      console.log(
        `[deal-context] ${logLabel} pinned deal=${pinned.travelDealId} "${pinned.title}" ` +
          `source=${pinned.source} distance=${pinned.distance?.toFixed(3) ?? "n/a"}`,
      );
    } else {
      const candidates = pickDealCandidates(matches);
      if (candidates.length) {
        dealCandidates = candidates.map(({ distance: _d, ...c }) => c);
        console.log(
          `[deal-context] ${logLabel} deal candidates offered: ` +
            candidates.map((c) => `"${c.title}"@${c.distance.toFixed(3)}`).join(", "),
        );
      }
    }
  } else if (ref) {
    // ALREADY PINNED — allow a correction ("no, it was the spring one"), but
    // only from a DETERMINISTIC match: an identifying fact the customer
    // actually gave. Distance must never move an existing pin, or ordinary
    // chatter would drift the conversation onto whichever deal looked closest
    // this turn. Un-seed the old deal first so its date/nights/airport don't
    // survive onto the enquiry (the new deal only fills BLANK slots).
    const corrected = pickDeterministicDealMatch(matches, query);
    if (corrected && corrected.travelDealId !== ref.travelDealId) {
      console.log(
        `[deal-context] ${logLabel} re-pinned deal=${corrected.travelDealId} "${corrected.title}" ` +
          `(was ${ref.travelDealId} "${ref.title}")`,
      );
      unseedSlotsFromDeal(slots, ref);
      ref = corrected;
      pinnedNow = corrected;
      repinned = true;
    }
  }

  // Hydrated fresh every turn (cheap: two small queries) so the AI always
  // quotes CURRENT hotel/flight detail, never the embedding's snapshot.
  const deal = ref ? await hydrateDealReplyContext(ref) : null;
  if (deal) {
    // A corrected pin is a different holiday, so the "as posted or any
    // tweaks?" check is owed again on the new deal.
    deal.tweakCheckPending = repinned || !checkAsked;
    const seededKeys = seedSlotsFromDeal(slots, deal);
    if (pinnedNow) pinnedNow.seededKeys = seededKeys;
  }
  return { pinnedNow, deal, dealCandidates, repinned, externalDealMention: external };
}

/** Load the pinned deal's live details (posted caption fields + the quote's
 *  hotel/board basis/flight times) for the prompt. Best-effort: null on any
 *  failure or if the deal row is gone — the turn proceeds without the block. */
export async function hydrateDealReplyContext(ref: DealRef): Promise<RetrievedDealContext | null> {
  try {
    const [deal, quoteCtx] = await Promise.all([
      socialPostRepository.findById(ref.travelDealId),
      newQuoteRepository.findDealReplyContext(ref.quoteId),
    ]);
    if (!deal) return null;
    const primaryAccom =
      quoteCtx.accommodations.find((a) => a.is_primary) ?? quoteCtx.accommodations[0] ?? null;
    return {
      title: deal.title,
      travelDate: deal.travelDate ?? null,
      nights: deal.nights ?? null,
      boardBasis: deal.boardBasis ?? primaryAccom?.board_basis_name ?? null,
      departureAirport: deal.departureAirport ?? null,
      price: deal.price ? `from £${deal.price} per person` : null,
      hotelName: primaryAccom?.accomodation_name ?? null,
      resort: primaryAccom?.resort_name ?? null,
      destination: primaryAccom?.destination_name ?? null,
      country: primaryAccom?.country_name ?? null,
      resortSummary: deal.resortSummary ?? null,
      luggageTransfers: deal.luggageTransfers ?? null,
      flights: quoteCtx.flights.map((f) => ({
        direction: f.flight_type ?? null,
        flightNumber: f.flight_number ?? null,
        from: f.departing_airport_name ?? null,
        to: f.arrival_airport_name ?? null,
        departs: f.departure_date_time ? new Date(f.departure_date_time).toISOString() : null,
        arrives: f.arrival_date_time ? new Date(f.arrival_date_time).toISOString() : null,
      })),
    };
  } catch (err) {
    console.warn(
      `[deal-context] hydrate failed (deal=${ref.travelDealId} quote=${ref.quoteId}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
