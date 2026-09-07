import type { ScrapedQuoteJson } from '../../easyjet/easyjet.types';
import type { ExtractionSpec } from './extraction.types';
import { parsePortListItinerary } from './extraction.interpreter';

// Post-extraction validator (EXTRACTION_AUDIT.md §4 Phase 1): a PURE function
// that looks at an already-produced ScrapedQuoteJson and says what, if
// anything, looks wrong. No I/O, no throwing, no Express — called from the
// SERVICE layer (scraper.service.ts) so the interpreter stays a pure mapper
// and the controller stays a HTTP translator. Every check below traces back to
// a bug that was actually reproduced (EXTRACTION_AUDIT.md §1); collecting ALL
// issues instead of stopping at the first is what turns a failed import into a
// localised ticket — "which field, which rule" — rather than a bare "no" (this
// is Fellegi–Holt edit-rule localisation).
//
// This never blocks an import (EXTRACTION_AUDIT.md §5, "Hard-fail on
// validation"): agents need the deal in front of them, so the worst this does
// is warn or record an error the caller can render — never throw.

export type IssueLevel = 'error' | 'warn';

export interface Issue {
  code: string;
  level: IssueLevel;
  field?: string;
  message: string;
}

export interface ValidationResult {
  level: 'ok' | 'warn' | 'error';
  issues: Issue[];
}

export interface ValidationContext {
  url: string;
  // The captured page's innerText. Pass '' when it isn't available (e.g. the
  // automated /scrape path, where the rendered DOM lives inside the adapter
  // closure and never reaches this layer) — every check below that needs page
  // text treats an empty string as "no evidence", never as "evidence of
  // absence", so an unavailable text simply skips those checks instead of
  // manufacturing false positives.
  text: string;
  title?: string;
  spec?: ExtractionSpec;
  // The page's h1/h2 text, when the caller has it (the manual capture path
  // only). Used ONLY to narrow CRUISE_ITINERARY_MISSING below: a heading
  // literally titled "Itinerary" can survive a collapsed drawer even when
  // `text` doesn't — the drawer's own section heading sits outside the
  // collapsed content that document.body.innerText excludes, so relying on
  // `text` alone would miss the exact capture this check exists to catch.
  headings?: string[];
}

// ─── Money ────────────────────────────────────────────────────────────────
// A failed price RULE in the interpreter returns 0 (deliberately — 0 makes
// isEmpty(0) true so the rule falls through to a fallback/other source), but
// nothing downstream distinguishes "this deal is free" from "every price rule
// missed". The result today is a £0 quote imported with a success toast
// (EXTRACTION_AUDIT.md §1.2). Zero is never a real deal price, so it is always
// an error, never merely "empty".
// Which of the two price fields to blame when they disagree. The arithmetic
// only proves they CAN'T BOTH be right, never which one is wrong — provenance
// is what settles it. A rule an agent picked was confirmed against a value
// they read off the real page; a generated rule has only passed shape checks.
// Since the attributed field is the one the client withholds, blaming the
// verified one throws away the trustworthy number and keeps the guess.
function blameUnverifiedPrice(ctx: ValidationContext): 'sales_price' | 'price_per_person' {
  const salesPicked = ctx.spec?.fields?.sales_price?.origin === 'picked';
  const perPersonPicked = ctx.spec?.fields?.price_per_person?.origin === 'picked';
  return salesPicked && !perPersonPicked ? 'price_per_person' : 'sales_price';
}

function checkMoney(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  if (!quote.sales_price || quote.sales_price === 0) {
    issues.push({
      code: 'PRICE_ZERO',
      level: 'error',
      field: 'sales_price',
      message: 'sales_price is 0 or missing. A failed price rule returns 0, which today imports as a "successful" £0 quote — zero is never a valid deal price.',
    });
  }

  const hasBoth = quote.sales_price > 0 && quote.price_per_person > 0;
  if (hasBoth) {
    // The Cunard bug: a per-person figure was written into the TOTAL price
    // field, so a family of 4 booking a £1,200pp cruise imported at £1,200
    // total instead of £4,800. Reconciling price_per_person × adults against
    // sales_price catches exactly that shape. 5% tolerance absorbs
    // single-supplement / rounding differences that are NOT this bug.
    if (quote.adults > 0) {
      const expectedTotal = quote.price_per_person * quote.adults;
      const diffRatio = Math.abs(quote.sales_price - expectedTotal) / quote.sales_price;
      if (diffRatio > 0.05) {
        // BLAME THE UNVERIFIED FIELD. The check only knows the two disagree,
        // not which is wrong — but provenance does: a rule an agent PICKED was
        // confirmed against a value they read off the real page, while a
        // generated rule has only ever passed shape checks. Attributing the
        // issue decides which field the client withholds, so getting this
        // backwards throws away the trustworthy number and keeps the guess.
        //
        // That is exactly what happened on Virgin Voyages: an agent picked
        // sales_price ("Grand total" → £2,013.10, verified), while the
        // generated price_per_person rule was reading "£2,065.10 (Includes
        // taxes & fees)" — the party TOTAL, not a per-person fare. The pair
        // could not reconcile, the verified total was withheld, and the form
        // fell back to 0 with the agent's own correct pick discarded.
        const blame = blameUnverifiedPrice(ctx);
        const verifiedNote =
          blame === 'price_per_person'
            ? ' sales_price was verified by hand on the page, so price_per_person is the rule to correct.'
            : '';
        issues.push({
          code: 'PRICE_PARTY_MISMATCH',
          level: 'error',
          field: blame,
          message: `sales_price (${quote.sales_price}) does not reconcile with price_per_person × adults (${quote.price_per_person} × ${quote.adults} = ${expectedTotal}) — looks like a per-person figure was recorded as the total (the Cunard bug).${verifiedNote}`,
        });
      }
    }

    // A total that is cheaper than what ONE person pays is never legitimate —
    // whichever of the two fields is wrong, the pair can't both stand. Blamed
    // the same way as the mismatch above, and for the same reason: pointing at
    // sales_price unconditionally would withhold a hand-verified total because
    // an unverified per-person rule disagreed with it.
    if (quote.sales_price < quote.price_per_person) {
      issues.push({
        code: 'PRICE_BELOW_PER_PERSON',
        level: 'error',
        field: blameUnverifiedPrice(ctx),
        message: `sales_price (${quote.sales_price}) is less than price_per_person (${quote.price_per_person}) — a total can never be cheaper than one person's share of it.`,
      });
    }
  }
}

// ─── Currency ─────────────────────────────────────────────────────────────
// interpreter.ts:1503 hard-defaults `currency: str(f.currency) || 'GBP'`, so a
// FAILURE to detect currency is indistinguishable from a genuine GBP deal
// (EXTRACTION_AUDIT.md §1.1) — a $3,000 Carnival cruise lands in a
// GBP-assumed field as "3000", a ~25-30% silent error on every US-market deal.
// This does NOT change the schema or the interpreter's default (out of scope
// for this module and explicitly not to be touched) — it only detects and
// reports the disagreement/uncertainty so the client can surface it.
//
// Resolved in strength order: an explicit ISO code stated on the page, a
// currency query param in the URL, a currency SYMBOL actually printed in the
// text, and — weakest, last resort — the domain's TLD/market segment. Only
// the first three are something the page or URL actually SAID; the TLD is an
// inference about the market, not a statement of currency, so resolving from
// it alone is never more than a warning.
const KNOWN_CURRENCIES = ['GBP', 'USD', 'EUR', 'AUD', 'CAD', 'NZD', 'CHF', 'JPY', 'SGD', 'HKD', 'ZAR', 'AED', 'INR'] as const;

const CURRENCY_SYMBOLS: { symbol: string; code: string }[] = [
  { symbol: '£', code: 'GBP' },
  { symbol: '$', code: 'USD' },
  { symbol: '€', code: 'EUR' },
];

// Royal Caribbean's deep links carry "selectedCurrencyCode"; Carnival's carry
// "currency". Matched case-insensitively, like every other URL-param reader in
// this pipeline (portals spell keys every which way).
const CURRENCY_URL_PARAMS = ['selectedcurrencycode', 'currencycode', 'currency', 'curr'];

// Registrable-suffix → currency, for the market-segment fallback. ".com" alone
// is genuinely ambiguous (easyJet.com is UK, Carnival.com is US) but is kept as
// a USD default since every ".com"-only operator seen in this pipeline's
// supplier set (Carnival, Celebrity, Princess) is a US operator — and because
// this tier only ever produces a WARNING, a wrong guess here costs nothing
// more than a flagged-for-review quote, never a silently wrong price.
const TLD_CURRENCY: Record<string, string> = {
  'co.uk': 'GBP', uk: 'GBP',
  'com.au': 'AUD', au: 'AUD',
  'co.nz': 'NZD', nz: 'NZD',
  ca: 'CAD',
  ch: 'CHF',
  ie: 'EUR', de: 'EUR', fr: 'EUR', es: 'EUR', it: 'EUR', nl: 'EUR', pt: 'EUR', at: 'EUR', be: 'EUR', fi: 'EUR', lu: 'EUR',
  com: 'USD', us: 'USD',
};

interface CurrencyResolution {
  code: string;
  source: 'text' | 'url' | 'symbol' | 'tld';
}

function currencyFromTld(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const labels = host.split('.').filter(Boolean);
    if (labels.length === 0) return null;
    const last2 = labels.slice(-2).join('.');
    const last1 = labels[labels.length - 1];
    return TLD_CURRENCY[last2] ?? TLD_CURRENCY[last1] ?? null;
  } catch {
    return null; // not a URL
  }
}

function resolveExpectedCurrency(ctx: ValidationContext): CurrencyResolution | null {
  if (ctx.text) {
    const re = new RegExp(`\\b(${KNOWN_CURRENCIES.join('|')})\\b`, 'i');
    const m = re.exec(ctx.text);
    if (m) return { code: m[1].toUpperCase(), source: 'text' };
  }

  try {
    const params = new URL(ctx.url).searchParams;
    const byLowerKey = new Map<string, string>();
    for (const [k, v] of params) if (!byLowerKey.has(k.toLowerCase())) byLowerKey.set(k.toLowerCase(), v);
    for (const key of CURRENCY_URL_PARAMS) {
      const v = byLowerKey.get(key);
      if (v && /^[a-z]{3}$/i.test(v)) return { code: v.toUpperCase(), source: 'url' };
    }
  } catch {
    /* not a URL */
  }

  if (ctx.text) {
    for (const { symbol, code } of CURRENCY_SYMBOLS) {
      if (ctx.text.includes(symbol)) return { code, source: 'symbol' };
    }
  }

  const tld = currencyFromTld(ctx.url);
  if (tld) return { code: tld, source: 'tld' };

  return null;
}

function checkCurrency(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  const resolved = resolveExpectedCurrency(ctx);

  if (!resolved || resolved.source === 'tld') {
    // Nothing on the page or in the URL stated a currency — either resolved
    // only from the weakest source (the domain's market segment) or not
    // resolved at all. Either way, quote.currency (very possibly the
    // interpreter's `|| 'GBP'` default) cannot be told apart from a genuine
    // GBP deal — warn rather than trust it silently.
    issues.push({
      code: 'CURRENCY_UNVERIFIED',
      level: 'warn',
      field: 'currency',
      message: resolved
        ? `Currency could only be inferred from the site's domain (${resolved.code}) — nothing on the page or in the URL stated it; "${quote.currency}" is unverified.`
        : `No currency evidence found on the page, in the URL, or from the domain — "${quote.currency}" is unverified (may be the interpreter's GBP default masking an undetected currency).`,
    });
    return;
  }

  if (quote.currency.toUpperCase() !== resolved.code) {
    issues.push({
      code: 'CURRENCY_MISMATCH',
      level: 'error',
      field: 'currency',
      message: `Quote currency is "${quote.currency}" but the page/URL indicates ${resolved.code} (via ${resolved.source}) — e.g. a $3,000 Carnival cruise landing in a GBP-assumed field.`,
    });
  }
}

// ─── Dates ────────────────────────────────────────────────────────────────
// Bans the exact shape EXTRACTION_AUDIT.md §1.6 calls out: z.coerce.date() and
// bare new Date(string) both silently accept garbage ("Route 66" → 1966,
// "Beverly Hills, 90210" → year 90210). Checking the ISO shape explicitly,
// then a sane calendar range, catches what coercion would have laundered into
// a schema-valid-but-wrong date.
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function checkDates(quote: ScrapedQuoteJson, issues: Issue[]): void {
  if (!DATE_ISO_RE.test(quote.travel_date || '')) {
    issues.push({
      code: 'DATE_NOT_ISO',
      level: 'error',
      field: 'travel_date',
      message: `travel_date "${quote.travel_date}" is not in YYYY-MM-DD form.`,
    });
    return; // nothing further to check against an unparseable date
  }

  const travelMs = Date.parse(`${quote.travel_date}T00:00:00Z`);
  // Compared as CALENDAR DAYS (midnight UTC), not raw instants: today's date at
  // midnight minus 1 day, so "yesterday" is always in range no matter what
  // time of day this check happens to run — an instant-based "now - 24h"
  // boundary would reject yesterday's date for anyone running this after
  // midnight local/UTC time.
  const todayMidnight = new Date();
  todayMidnight.setUTCHours(0, 0, 0, 0);
  const minMs = todayMidnight.getTime() - MS_PER_DAY; // today - 1 day
  const maxDate = new Date(todayMidnight);
  maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 3); // today + 3 years
  const maxMs = maxDate.getTime();

  if (travelMs < minMs || travelMs > maxMs) {
    issues.push({
      code: 'DATE_OUT_OF_RANGE',
      level: 'error',
      field: 'travel_date',
      message: `travel_date "${quote.travel_date}" falls outside the plausible booking window (yesterday .. +3 years).`,
    });
  }
}

// ─── Cross-field consistency ────────────────────────────────────────────────
// A day-by-day itinerary is the one part of a cruise page with an independent
// ground truth for the sailing's length: N days on the table can only ever
// mean N-1 nights. When the two disagree it usually means the itinerary
// parser or the nights field drifted from the other, not that the sailing
// itself is inconsistent.
//
// It does NOT hold for an itinerary read from a PORT LIST. MSC prints
// "Santa Cruz De Tenerife | Puerto Del Rosario | Funchal (+ 3)" and states no
// day for any port, so the rows carry sequence positions rather than calendar
// days — and when the list is knowably incomplete ("(+ 3)"), the count is
// short by construction. Firing here would mean every MSC cruise raised this
// warning AND CRUISE_ITINERARY_PARTIAL, for the same already-reported cause.
// Two warnings for one fact is how a panel gets ignored, which is the same
// lesson the prose heuristic taught.
function checkItineraryNights(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  if (!quote.itinerary || quote.itinerary.length === 0) return;
  if (isPartialPortList(quote, ctx)) return;
  const dayCount = new Set(quote.itinerary.map((i) => i.day)).size;
  if (dayCount > 0 && quote.no_of_nights !== dayCount - 1) {
    issues.push({
      code: 'NIGHTS_ITINERARY_MISMATCH',
      level: 'warn',
      field: 'no_of_nights',
      message: `no_of_nights (${quote.no_of_nights}) does not equal the itinerary's day count minus one (${dayCount} days → ${dayCount - 1} nights).`,
    });
  }
}

// ─── Cruise itinerary missing ────────────────────────────────────────────────
// The failure that motivated capturing `deepText` at all: an agent captured a
// Royal Caribbean checkout page without opening the "View Ports" drawer.
// document.body.innerText excludes collapsed content, so the whole day-by-day
// itinerary was absent from `text` — even though it was in the DOM the whole
// time (an image inside the drawer WAS captured, and "Itinerary" was in
// `headings`) — and the cruise imported with no itinerary, silently. The
// interpreter's deepText fallback (extraction.interpreter.ts) recovers this
// when a re-capture sends `deepText`, but an OLDER capture, or one where even
// deepText missed, still needs the loss to be visible rather than silent.
//
// Not every cruise page legitimately has a day-by-day plan to lose — Virgin
// Voyages' summary screen states the ship, the sailing and the cabin and
// never prints one (EXTRACTION_STATUS.md §3.2) — so this only fires when
// there's actual evidence the page HAS one: the spec having bothered to
// declare an itineraryRegex (an author decided this supplier prints one), or
// the word "itinerary" appearing on the page (body text, title or a heading)
// at all. Without that narrowing, a page like Virgin's would be flagged on
// every single import.
const ITINERARY_MENTION_RE = /\bitinerary\b/i;

function checkCruiseItineraryMissing(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  if (!quote.cruise_line) return; // not a cruise
  if (quote.itinerary && quote.itinerary.length > 0) return;

  const declaresItinerary = !!ctx.spec?.itineraryRegex;
  const mentionsItinerary =
    ITINERARY_MENTION_RE.test(ctx.text) ||
    ITINERARY_MENTION_RE.test(ctx.title ?? '') ||
    (ctx.headings ?? []).some((h) => ITINERARY_MENTION_RE.test(h));
  if (!declaresItinerary && !mentionsItinerary) return; // may legitimately have no day-by-day plan

  issues.push({
    code: 'CRUISE_ITINERARY_MISSING',
    level: 'warn',
    field: 'itinerary',
    message:
      'This is a cruise and the page appears to describe a day-by-day itinerary, but none was extracted. ' +
      'The likely cause: the itinerary panel/drawer was collapsed when the page was captured — it is absent ' +
      'from the captured text even though it exists in the DOM. Re-open it (e.g. "View Ports") and re-capture.',
  });
}

// ─── Cruise itinerary partial (the MSC "(+ N)" page) ─────────────────────────
// A page can state MORE ports than it renders. MSC's cruise-summary page
// prints "Santa Cruz De Tenerife | Puerto Del Rosario | Funchal (+ 3)" — three
// ports in the DOM, three more the page itself says exist but that load only
// once "View itinerary" is clicked. The interpreter's parsePortListItinerary
// (extraction.interpreter.ts) is the reader for this shape and already
// separates the visible ports from that hidden count; a capture that never
// opened "View itinerary" therefore produces an itinerary that LOOKS complete
// (no zero-row alarm — CRUISE_ITINERARY_MISSING won't fire) while quietly
// missing half the sailing.
//
// Reaching the hidden count here: the interpreter's `ScrapedQuoteJson` is not
// given a new field for it. Three routes were available — (a) add a field to
// ScrapedQuoteJson, (b) have the interpreter stash it somewhere on the quote,
// or (c) have the validator re-run the same exported, pure parser against the
// page text it already receives. (c) was taken: this validator already
// re-derives its own evidence from `ctx.text` for exactly this reason
// (checkCaptureComplete re-applies the spec's own wait.textMatches the same
// way), the interpreter stays a pure mapper untouched by a validator-only
// concern, and no schema/type migrates for a value that is cheap to
// recompute. The cost is that a sailing recovered ONLY from `deepText` (never
// `ValidationContext`, which — like `text` — only carries the visible page)
// can't be cross-checked this way; that mirrors every other check in this
// file, which reasons about the visible capture, and the real MSC page this
// exists for states its port list directly in the visible text, not behind a
// collapsed drawer.
//
// Guarded to fire only once at least one port WAS extracted: a page with no
// itinerary at all belongs to CRUISE_ITINERARY_MISSING above, and the two
// must never both fire for the same import.
// True when this quote's itinerary came from a PORT LIST that declared more
// ports than were captured. Shared with checkItineraryNights above, which must
// stay silent in that case: the rows are sequence positions, not days, and the
// list is knowably short, so a nights-vs-days comparison is meaningless rather
// than merely wrong.
function isPartialPortList(quote: ScrapedQuoteJson, ctx: ValidationContext): boolean {
  const extracted = quote.itinerary?.length ?? 0;
  if (!extracted || !ctx.text) return false;
  const portList = parsePortListItinerary(ctx.text);
  if (!portList.ports.length) return false;
  return portList.ports.length + portList.hiddenCount > extracted;
}

function checkCruiseItineraryPartial(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  if (!quote.cruise_line) return; // not a cruise
  const extractedCount = quote.itinerary?.length ?? 0;
  if (extractedCount === 0) return; // CRUISE_ITINERARY_MISSING's territory, not this check's

  if (!ctx.text) return;
  const portList = parsePortListItinerary(ctx.text);
  if (!portList.ports.length) return; // no port-list shape on this page — nothing to compare against

  const declaredCount = portList.ports.length + portList.hiddenCount;
  if (declaredCount > extractedCount) {
    issues.push({
      code: 'CRUISE_ITINERARY_PARTIAL',
      level: 'warn',
      field: 'itinerary',
      message:
        `The page's port list states ${declaredCount} ports of call but only ${extractedCount} were captured ` +
        `(the MSC "(+ ${portList.hiddenCount})" shape — extra ports load only once "View itinerary" is opened). ` +
        'Re-open the itinerary panel/drawer so the full list renders, then re-capture.',
    });
  }
}

// Cunard: the title said "28-night", the body said "27 nights", the sailing
// calendar (the ground truth) also said 27 — the title was simply wrong. Two
// independently-read counts disagreeing is a signal worth surfacing even
// before anyone can say which one is right.
const NIGHTS_WORDING_RE = /\b(\d{1,2})[-\s]nights?\b/i;

function nightsFromWording(s: string | undefined): number | null {
  if (!s) return null;
  const m = NIGHTS_WORDING_RE.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n < 100 ? n : null;
}

function checkNightsSourceConflict(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  const titleNights = nightsFromWording(ctx.title) ?? nightsFromWording(quote.quote_title) ?? nightsFromWording(quote.cruise_title);
  const bodyNights = nightsFromWording(ctx.text);
  if (titleNights != null && bodyNights != null && titleNights !== bodyNights) {
    issues.push({
      code: 'NIGHTS_SOURCE_CONFLICT',
      level: 'warn',
      field: 'no_of_nights',
      message: `The title states ${titleNights} nights but the page body states ${bodyNights} nights — they disagree (the Cunard bug: title said 28, body/calendar said 27).`,
    });
  }
}

// ─── Prose detection ────────────────────────────────────────────────────────
// The worst class of extraction bug isn't a missing value, it's a WRONG one
// that reads as plausible: TUI's arrival-airport rule used `group: 0` (the
// whole match) and returned "to your hotel, and back to the airport at the
// end of your stay" as an airport name (EXTRACTION_AUDIT.md §1.3); a
// marketing sentence has landed in a ship name, a hotel name, a quote title.
// None of these fields is ever legitimately a sentence, so anything that
// LOOKS like prose — long, multi-word, or a stock phrase repeated all over
// the page (a nav link, a footer line, a filter label) — is flagged.
//
// The word-count limit is deliberately low (3, not the ~5-6 a real proper
// noun can reach — "Independence of the Seas", "Barcelo Bavaro Palace"). The
// real bug this catches (EXTRACTION_STATUS.md §3.1, Royal Caribbean)
// is `ship_name` matching "Thrilling onboard activities" — three words,
// 27 characters, well under the 60-char length gate, and (in isolation, with
// no page text to check repetition against) the ONLY signal available that
// it's a fragment of marketing copy and not a name is that it reads as a
// phrase, not a noun. This is a warning, not a hard-fail, so the occasional
// false positive on a genuinely 3-word proper noun costs a flagged-for-review
// quote, never a blocked import — an acceptable trade against silently
// importing "Thrilling onboard activities" as a ship's name.
const PROSE_LENGTH_LIMIT = 60;
// Word count alone cannot separate prose from a real name, and tuning it down
// to catch short marketing phrases destroys the check. Measured against the
// values this pipeline actually produced: a limit of 3 flagged SEVEN of ten
// correct values — "Freedom of the Seas", "Southern Caribbean & Aruban
// Nights", "3-Day The Bahamas from Miami, FL", "Plaza Prague Hotel" — while
// STILL missing "IMPORTANT NOTICE" and "Best room". A warning that fires on
// most valid imports is worse than no warning: it teaches agents to ignore the
// panel, which then hides the real failures. Keep the word limit loose enough
// that no genuine ship, hotel or voyage name trips it.
const PROSE_WORD_LIMIT = 7;
const PROSE_REPEAT_LIMIT = 3;

// What actually separates the two classes is VOCABULARY. Ships, hotels and
// voyages are named after places, people and adjectives; they are never named
// after the things a brochure says about them. Every word here appeared in a
// real mis-extraction ("Thrilling onboard ACTIVITIES", "Non-stop
// ENTERTAINMENT", "IMPORTANT NOTICE", "BEST room choice according to…"), and
// none appears in any correct value this pipeline has produced.
const MARKETING_LEXICON =
  /\b(activities|activity|included|includes|including|options?|entertainment|programmes?|programs?|experience|enjoy|discover|save|offer|available|choice|notice|best|thrilling|award-winning)\b/i;

function countOccurrences(haystack: string, needle: string): number {
  if (!haystack || !needle) return 0;
  const hay = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = hay.indexOf(n, idx)) !== -1) {
    count += 1;
    idx += n.length;
  }
  return count;
}

function looksLikeProse(value: string, pageText: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > PROSE_LENGTH_LIMIT) return true;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount >= PROSE_WORD_LIMIT) return true;
  // A brochure word in an identity field is the strongest single signal, and
  // the only one that catches a SHORT stock phrase like "Thrilling onboard
  // activities" (3 words, 27 chars) without flagging "Freedom of the Seas".
  if (MARKETING_LEXICON.test(trimmed)) return true;
  if (pageText && countOccurrences(pageText, trimmed) > PROSE_REPEAT_LIMIT) return true;
  return false;
}

const PROSE_IDENTITY_FIELDS = ['ship_name', 'accommodation', 'quote_title', 'cruise_title'] as const;

function checkProseFields(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  for (const field of PROSE_IDENTITY_FIELDS) {
    const value = quote[field];
    if (typeof value === 'string' && looksLikeProse(value, ctx.text)) {
      issues.push({
        code: 'FIELD_LOOKS_LIKE_PROSE',
        level: 'warn',
        field,
        message: `${field} ("${value}") reads like marketing prose or a stock phrase, not a name — e.g. "Thrilling onboard activities" or "IMPORTANT NOTICE" landing in an identity field.`,
      });
    }
  }

  quote.flights?.forEach((flight, i) => {
    for (const key of ['departing_airport_name', 'arrival_airport_name'] as const) {
      const value = flight[key];
      if (value && looksLikeProse(value, ctx.text)) {
        issues.push({
          code: 'FIELD_LOOKS_LIKE_PROSE',
          level: 'warn',
          field: `flights[${i}].${key}`,
          message: `flights[${i}].${key} ("${value}") reads like marketing prose, not an airport name — e.g. TUI's "to your hotel, and back to the airport at the end of your stay" (a group:0 capture-the-whole-match bug).`,
        });
      }
    }
  });
}

// ─── Capture completeness ────────────────────────────────────────────────────
// A spec's own wait.textMatches already exists to tell the AUTOMATED /scrape
// path when the priced quote has rendered (dom.adapter.ts waits for it before
// reading the DOM). The manual capture path has no such wait — the agent's own
// browser sends whatever it captured — so this re-applies the same field as a
// post-hoc gate: if the text the spec expects to see once the page is ready
// never appears, the capture was probably taken before the price finished
// loading. Only evaluated when real page text is available (ctx.text) — an
// empty ctx.text means "not supplied" here, not "the page was blank", so it
// must never fabricate this error for a caller that has no text to check.
function checkCaptureComplete(ctx: ValidationContext, issues: Issue[]): void {
  const textMatches = ctx.spec?.wait?.textMatches;
  if (!textMatches || !ctx.text) return;
  let re: RegExp | null = null;
  try {
    re = new RegExp(textMatches, 'i');
  } catch {
    return; // an invalid stored pattern is a spec problem, not a capture one
  }
  if (!re.test(ctx.text)) {
    issues.push({
      code: 'CAPTURE_INCOMPLETE',
      level: 'error',
      message: `The captured page never showed the pattern the spec expects once the deal has fully rendered (/${textMatches}/) — the price hadn't finished loading. Re-open the deal, wait for the price to show, then capture again.`,
    });
  }
}

// ─── Coverage ────────────────────────────────────────────────────────────────
// A spec is trusted indefinitely once learned, with nothing to notice when it
// degrades (EXTRACTION_AUDIT.md thesis). A high fraction of the spec's OWN
// declared field rules resolving empty is the cheapest available drift
// signal: it doesn't need a ground truth, just the spec's own promises.
const SPEC_COVERAGE_WARN_THRESHOLD = 0.4;

function isResolvedEmpty(v: unknown): boolean {
  return v === '' || v === 0 || v == null;
}

function checkSpecCoverage(quote: ScrapedQuoteJson, ctx: ValidationContext, issues: Issue[]): void {
  const fields = ctx.spec?.fields;
  if (!fields) return;
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const record = quote as unknown as Record<string, unknown>;
  const emptyCount = keys.filter((key) => isResolvedEmpty(record[key])).length;
  const fraction = emptyCount / keys.length;

  if (fraction > SPEC_COVERAGE_WARN_THRESHOLD) {
    issues.push({
      code: 'SPEC_COVERAGE_LOW',
      level: 'warn',
      message: `${emptyCount}/${keys.length} of the spec's declared field rules (${Math.round(fraction * 100)}%) resolved empty — the spec may have drifted from the page's current layout.`,
    });
  }
}

function overallLevel(issues: Issue[]): 'ok' | 'warn' | 'error' {
  if (issues.some((i) => i.level === 'error')) return 'error';
  if (issues.length > 0) return 'warn';
  return 'ok';
}

export function validateQuote(quote: ScrapedQuoteJson, ctx: ValidationContext): ValidationResult {
  const issues: Issue[] = [];

  checkMoney(quote, ctx, issues);
  checkCurrency(quote, ctx, issues);
  checkDates(quote, issues);
  checkItineraryNights(quote, ctx, issues);
  checkCruiseItineraryMissing(quote, ctx, issues);
  checkCruiseItineraryPartial(quote, ctx, issues);
  checkNightsSourceConflict(quote, ctx, issues);
  checkProseFields(quote, ctx, issues);
  checkCaptureComplete(ctx, issues);
  checkSpecCoverage(quote, ctx, issues);

  return { level: overallLevel(issues), issues };
}
