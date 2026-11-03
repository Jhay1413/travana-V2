import type { ExtractionSpec, FieldRule, FieldSource, FieldTransform, FlightsSectionSpec } from './extraction.types';
import { findUnsafeRules } from './extraction-ai.service';
import { extractFlightsSection, extractItinerarySection, titleCaseSlug } from './extraction.interpreter';

// ─── Visual field-picker → verified extraction spec (EXTRACTION_AUDIT.md §4 Phase 2/5) ──
//
// §3 of the audit is the reason this file exists: inducing a rule from ONE
// example page is ~29 F1 points worse than not bothering (EVAPORATE, VLDB'24),
// because a single example can't tell a durable anchor (a label, a URL param)
// from an accident of that one page (a marketing sentence, a hardcoded ship
// name). The picker can't fix that with more examples — an agent clicks a
// field once — so instead every candidate rule is VERIFIED by replaying it
// against the very capture it was induced from and rejecting anything that
// doesn't reproduce the picked value byte-for-byte. That is what turns a guess
// into a rule: an unverified candidate is discarded, never stored, and the
// field is reported as a DerivationProblem instead of a rule that looks
// plausible and is wrong (the "schema-valid is not correct" trap in §3).
//
// This module is a PURE function — no I/O, no AI call, no DB — so it is fully
// unit-testable and, per CLAUDE.md, sits below the service layer with no
// Express/SQL awareness of its own.

// ─── The picker's input contract (FIXED — shared with the bookmarklet) ──────
export interface PickedField {
  field: string; // 'sales_price' | 'ship_name' | ...
  value: string; // the element's visible text, trimmed — GROUND TRUTH for this page
  textIndex: number; // index of `value` within the page innerText; -1 if not locatable
  lineIndex: number; // 0-based line number within the innerText; -1 if not locatable
  linesBefore: string[]; // up to 3 preceding NON-EMPTY lines, nearest LAST
  linesAfter: string[]; // up to 2 following NON-EMPTY lines
  occurrenceIndex: number; // which occurrence of `value` in the text this is
  occurrenceCount: number; // how many times `value` occurs in the whole text
  tag: string;
  ancestorTags: string[];
  siblingIndex: number;
}

export interface PickerCaptureContext {
  url: string;
  title: string;
  text: string;
  headings?: string[];
  // Alternative captured texts, used ONLY to locate a flights_section pick
  // (some pages render the flight cards solely in deepText).
  deepText?: string;
  flightsText?: string;
  // The package type the AGENT declared when arming the picker (see
  // capture-bookmarklet.js — picker mode now asks Cruise / Package Holiday /
  // Hot Tub Break before showing fields). Passed straight onto the derived
  // spec as ExtractionSpec.packageType, which the interpreter then treats as
  // AUTHORITATIVE over its own field-based inference (extraction.types.ts) —
  // the same fix that stops one broken ship_name rule from silently importing
  // a cruise as a package holiday (the Virgin Voyages bug) now also applies to
  // a picker-derived spec, not just an AI-generated one.
  packageType?: ExtractionSpec['packageType'];
}

export type DerivationStrategy =
  | 'url-param'
  | 'label-anchored'
  | 'inline-label'
  | 'label-after'
  | 'heading-position'
  | 'title-prefix'
  | 'title-segment'
  | 'url-path-slug'
  | 'value-pattern-line'
  | 'party-count'
  | 'line-offset';

export interface DerivedRule {
  field: string;
  rule: FieldRule;
  strategy: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface DerivationProblem {
  field: string;
  reason: string;
}

export interface PickerSpecResult {
  spec: ExtractionSpec;
  derived: DerivedRule[];
  problems: DerivationProblem[];
}

// ─── mergePickedIntoSpec's result (see below) ────────────────────────────────
export interface MergeResult {
  spec: ExtractionSpec;
  applied: { field: string; strategy: string; confidence: string; verifiedValue: string; replaced: 'generated' | 'picked' | null }[];
  preserved: string[]; // spec-level keys kept from the existing spec
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Text a rule with a given `from` would actually read at runtime. Mirrors the
// source-selection in extraction.interpreter.ts's resolveField exactly
// (headings joined one-per-line, url read raw/undecoded, text/title as
// captured) so a candidate that verifies here behaves identically once stored
// and run for real.
function sourceFor(from: FieldSource | undefined, ctx: { title: string; text: string; url: string; headingsText: string }): string {
  if (from === 'title') return ctx.title;
  if (from === 'headings') return ctx.headingsText;
  if (from === 'url') return ctx.url;
  return ctx.text;
}

// Replicates resolveField's regex-selection step ONLY (extraction.interpreter.ts
// is not exported at that granularity, and must not be modified here). This is
// deliberately the raw, PRE-transform extraction — verification checks that the
// rule's regex/source picks out the exact substring the human picked, byte for
// byte; the transform (money → number, etc.) is a display-time concern applied
// afterwards by the same interpreter and is inferred separately below.
//
// Regexes compile WITHOUT the 'm' flag, exactly as the interpreter does
// (EXTRACTION_AUDIT.md §1.8: with no 'm' flag, `^` means "start of the whole
// page", not "start of a line" — every mid-page `^label` anchor silently fails).
// That is why label-anchored/line-offset rules below anchor with `(?:^|\n)`
// instead of a bare `^` — the only way to match "start of a line" under the
// same flags this candidate will actually run with.
function extractRaw(rule: Pick<FieldRule, 'from' | 'regex' | 'group'>, ctx: { title: string; text: string; url: string; headingsText: string }): string | null {
  if (!rule.regex) return null;
  const source = sourceFor(rule.from, ctx);
  let re: RegExp;
  try {
    re = new RegExp(rule.regex, 'i');
  } catch {
    return null;
  }
  const m = re.exec(source);
  if (!m) return null;
  return m[rule.group ?? 1] ?? null;
}

// Candidate rules capture `[^\n]+` up to the next newline, greedily, which
// includes anything sitting between the value and the line break: a stray
// trailing space left in the source markup, a \r from a captured line ending
// (some captures preserve \r\n), or an &nbsp; rendered into text as  .
// `pick.value` is documented as the element's trimmed visible text (see
// PickedField.value above), so a byte-for-byte `===` against a raw, untrimmed
// capture rejects a rule that is actually correct — and, critically, that
// rejection happens ONLY here: extraction.interpreter.ts's finalize() trims
// every extracted value unconditionally before it's used at real scrape time
// (see applyTransform there), so the padding this strips would have been
// harmless in production anyway. Normalising both sides the same way finalize
// does keeps verify() from being stricter than the interpreter it's meant to
// predict. This is ONLY a trim — it does not collapse internal whitespace —
// so it cannot make a candidate match text it wouldn't otherwise match; it
// only tolerates the leading/trailing padding production already discards.
function normalizeForVerify(s: string): string {
  return s.trim();
}

// Mirrors titleCaseSlug in extraction.interpreter.ts (not exported there, and
// that file must not be touched from here). Needed because url-path-slug
// captures a hyphenated slug ("white-cross-bay") and relies on the rule's
// 'titleCase' transform to turn it into the picked value — so verification of
// THAT strategy has to replay the transform too, or it could never reproduce
// the value. Imported from the interpreter rather than copied, so the replay
// can't drift away from the transform it is meant to mirror.

// `replay` is ONLY set by a strategy whose raw capture is deliberately not the
// final value (url-path-slug). Every other strategy verifies the raw capture
// exactly as before — the money 'number' transform in particular is still
// applied downstream and never replayed here (the PRICE_ZERO chain).
function verify(
  rule: FieldRule,
  ctx: { title: string; text: string; url: string; headingsText: string },
  expected: string,
  replay?: 'titleCase',
): boolean {
  const raw = extractRaw(rule, ctx);
  if (raw == null) return false;
  const value = replay === 'titleCase' ? titleCaseSlug(raw) : raw;
  return normalizeForVerify(value) === normalizeForVerify(expected);
}

// A picker-derived rule must clear the same bar the AI generator's output does
// — a picker is just another way to produce a spec, and it must not be able to
// hand-craft a rule the generator would be refused for (group:0 dumping a
// whole sentence, a proper-noun fallback, a top-level `|`, a 30+ char literal
// anchor). findUnsafeRules is imported directly rather than re-implemented:
// extraction-ai.service.ts has no dependency on this module, so importing it
// here does not create a cycle.
function passesSafetyChecks(field: string, rule: FieldRule): boolean {
  const probe: ExtractionSpec = { version: 1, fields: { [field]: rule } };
  return findUnsafeRules(probe).length === 0;
}

// ─── Candidate strategy 1: url-param ─────────────────────────────────────────
//
// The single most durable anchor available: a query param outlives redesigns
// that break every DOM/text rule (Royal Caribbean's selectedCurrencyCode,
// Carnival's sailDate). Built against the RAW url string — same as the
// interpreter reads it — so a param whose value is percent-encoded correctly
// fails verification below rather than being silently accepted as a false
// match.
function tryUrlParam(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy } | null {
  let parsed: URL;
  try {
    parsed = new URL(ctx.url);
  } catch {
    return null;
  }
  for (const [key, value] of parsed.searchParams.entries()) {
    if (value !== pick.value) continue;
    return {
      rule: { from: 'url', regex: `${escapeRegExp(key)}=([^&]+)`, group: 1 },
      strategy: 'url-param',
    };
  }
  return null;
}

// ─── Candidate strategy 2: label-anchored ────────────────────────────────────
//
// The strategy behind every durable fix in §3 ("Trip total", "On Board",
// "Leaving from", "Choose cabin"): anchor on the LABEL, not the value, because
// the label is stable copy while the value changes per deal. `linesBefore` is
// nearest-last, so the immediate preceding line is tried first.
function looksLikeLabel(candidate: string, value: string): boolean {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed === value) return false; // can't anchor a value on itself
  if (/^\d+$/.test(trimmed)) return false; // digits-only line ("2026") isn't a label
  if (isUnstableAnchorLine(trimmed)) return false; // price/date/time/count lines change per deal
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 5;
}

// Lines that carry a VALUE which changes per deal or per day ("Was £2,199",
// "Sat 12 Oct 2026", "Only 3 left", "12:30", "25% off"). Anchoring a rule on
// one breaks the moment the value moves, days after it was verified. Small
// numbers in a stable label ("Adults (18+)") stay acceptable: >2 digits trips it.
const MONTH_NAMES =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY_NAMES = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const DATE_ISO_SEARCH_RE = /\b\d{4}-\d{2}-\d{2}\b/;
const DATE_NUMERIC_SEARCH_RE = /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/;
const DATE_DAY_MONTH_SEARCH_RE = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_NAMES}\\b`, 'i');
const DATE_MONTH_DAY_SEARCH_RE = new RegExp(`\\b${MONTH_NAMES}\\.?\\s+\\d{1,2}\\b`, 'i');
const WEEKDAY_DAY_SEARCH_RE = new RegExp(`\\b${WEEKDAY_NAMES}\\b[,.]?\\s+\\d{1,2}\\b`, 'i');
const CLOCK_TIME_RE = /\b\d{1,2}:\d{2}\b/;
const PERCENT_RE = /\d\s?%/;
// Urgency / scarcity copy: "Only 3 left", "Offer ends in 2 days", "5 rooms remaining".
const URGENCY_RE = /\b(?:only|ends?|expires?|hurry)\b[^\n]*\d|\d+\s*(?:left|remaining|days?|hours?|hrs?|mins?|minutes?|seconds?|rooms?|seats?|spaces?)\b/i;

function isUnstableAnchorLine(line: string): boolean {
  if (MONEY_SYMBOL_RE.test(line) || MONEY_THOUSANDS_RE.test(line)) return true;
  if (
    DATE_ISO_SEARCH_RE.test(line) ||
    DATE_NUMERIC_SEARCH_RE.test(line) ||
    DATE_DAY_MONTH_SEARCH_RE.test(line) ||
    DATE_MONTH_DAY_SEARCH_RE.test(line) ||
    WEEKDAY_DAY_SEARCH_RE.test(line)
  ) {
    return true;
  }
  if (CLOCK_TIME_RE.test(line) || PERCENT_RE.test(line) || URGENCY_RE.test(line)) return true;
  return (line.match(/\d/g) ?? []).length > 2;
}

// Between the label and the value a supplier may later insert promo lines
// ("Was £2,499", "Save £300", "From", "RRP"). Up to two such lines are skipped.
// No inline (?i): the interpreter compiles every rule with the 'i' flag
// (safeRegex / new RegExp(.., 'i')), so plain words are already case-insensitive.
const PROMO_WORDS = 'was|save|saving|rrp|from|now|previously|discount';
const PROMO_START_RE = new RegExp(`^(?:${PROMO_WORDS})\\b`, 'i');
const PROMO_SKIP = `(?:(?:${PROMO_WORDS})\\b[^\\n]*\\n+\\s*){0,2}`;

// Label-then-next-line regex. If the picked value itself starts with a promo
// word (e.g. "From Manchester") the skip group would swallow it, so omit it.
function anchoredRegex(label: string, value: string): string {
  const skip = PROMO_START_RE.test(value.trim()) ? '' : PROMO_SKIP;
  return `(?:^|\\n)\\s*${escapeRegExp(label)}\\s*\\n+\\s*${skip}([^\\n]+)`;
}

// How many times a candidate label appears as its OWN line in the page text.
// A label that repeats (once per guest, once per cabin) can anchor the WRONG
// occurrence just as easily as the right one — this is exactly how "Taxes and
// fees" picked up only the first guest's amount (EXTRACTION_AUDIT.md §1.9's
// sibling bug class). Used to gate confidence, not to reject the rule outright
// — it still verifies against THIS capture.
function labelOccurrences(text: string, label: string): number {
  const re = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(label)}\\s*\\n`, 'gi');
  return (text.match(re) ?? []).length;
}

// ─── Long-anchor fragments ───────────────────────────────────────────────────
//
// The only distinctive neighbour of a pick is sometimes a LONG line:
// "New York City NY - Show on map > 2.5 km from selected location". Anchoring on
// the whole line is refused (not a label; far past findUnsafeRules' 30-char
// literal-run limit, which stops brittle sentence anchors and is NOT raised).
// Instead anchor on a short STABLE PHRASE inside it. Selection rule:
//   1. 2-3 consecutive tokens, each purely letters (no digits, prices, symbols or
//      punctuation: those change per deal), joined length <= FRAGMENT_MAX_CHARS.
//   2. Reads as UI copy, not content: every word after the first is lowercase
//      (a capitalised mid-phrase word is a proper noun - "New York City"), the
//      first may be capitalised only at line start or right after a separator
//      token ("-", ">", "|"), and an ALL-CAPS token ("NY") is never used.
//   3. Neither end is a stopword ("on map" loses to "Show on map").
//   4. UNIQUE on the captured page: exactly one line contains it (as whole
//      words), the same bar tryLabelAfter sets for its anchor.
// Ranked: more words first, then phrase-initial ("Show on map") before a
// mid-clause slice ("selected location"). Fragment candidates are only ever
// appended AFTER every pre-existing candidate, so picks that already resolved
// keep their rule, and their confidence is capped below 'high'.
const FRAGMENT_MAX_CHARS = 24;
const FRAGMENT_MAX_PER_LINE = 3;
const FRAGMENT_STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'on', 'in', 'at', 'to', 'from', 'for', 'and', 'or', 'by', 'with', 'is', 'are', 'per', 'as', 'it', 'be',
]);
const FRAGMENT_WORD_RE = /^[A-Za-z][A-Za-z'’-]*$/;

// Regex source for a fragment: whitespace runs become [ \t]+ (never \s), whole words only.
function fragmentPattern(words: string[]): string {
  return `\\b${words.map(escapeRegExp).join('[ \\t]+')}\\b`;
}

function fragmentLineCount(text: string, pat: string): number {
  const re = new RegExp(pat, 'i');
  return text.split(/\r?\n/).filter((l) => re.test(l)).length;
}

// Unique, stable-looking fragments of `line`, best first. Empty when none qualify.
function anchorFragments(line: string, text: string): string[] {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const found: { pat: string; words: number; initial: boolean }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 3; n >= 2 && i + n <= tokens.length; n--) {
      const words = tokens.slice(i, i + n);
      if (!words.every((w) => FRAGMENT_WORD_RE.test(w))) continue;
      if (words.join(' ').length > FRAGMENT_MAX_CHARS) continue;
      if (FRAGMENT_STOPWORDS.has(words[0].toLowerCase()) || FRAGMENT_STOPWORDS.has(words[n - 1].toLowerCase())) continue;
      if (words.slice(1).some((w) => !/^[a-z]/.test(w))) continue; // proper noun / acronym mid-phrase
      const first = words[0];
      if (first.length > 1 && first === first.toUpperCase()) continue; // acronym ("NY")
      if (i > 0 && /\d/.test(tokens[i - 1])) continue; // starts with a unit ("km from ...") glued to a per-deal number
      const initial = i === 0 || !FRAGMENT_WORD_RE.test(tokens[i - 1]);
      if (/^[A-Z]/.test(first) && !initial) continue; // capitalised mid-sentence: a name
      const pat = fragmentPattern(words);
      if (fragmentLineCount(text, pat) !== 1) continue;
      found.push({ pat, words: n, initial });
    }
  }
  found.sort((a, b) => b.words - a.words || Number(b.initial) - Number(a.initial));
  return [...new Set(found.map((f) => f.pat))].slice(0, FRAGMENT_MAX_PER_LINE);
}

// Preceding-line anchor on a fragment of a line that is not usable whole.
function fragmentAnchoredRegex(pat: string, value: string): string {
  const skip = PROMO_START_RE.test(value.trim()) ? '' : PROMO_SKIP;
  return `(?:^|\\n)[^\\n]*?${pat}[^\\n]*\\n+\\s*${skip}([^\\n]+)`;
}

// Fragment candidates for every preceding line that is not label-like (too long,
// too many words) to anchor whole. Nearest first.
function tryLabelAnchoredFragments(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy }[] {
  const out: { rule: FieldRule; strategy: DerivationStrategy }[] = [];
  for (let i = pick.linesBefore.length - 1; i >= 0; i--) {
    const line = pick.linesBefore[i];
    if (!line.trim() || looksLikeLabel(line, pick.value)) continue;
    for (const pat of anchorFragments(line, ctx.text)) {
      out.push({ rule: { from: 'text', regex: fragmentAnchoredRegex(pat, pick.value), group: 1 }, strategy: 'label-anchored' });
    }
  }
  return out;
}

// Following-line anchor on a fragment of a long line (label-after's fallback
// when tryLabelAfter finds neither a label nor an inline "Label amount").
function tryLabelAfterFragments(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy }[] {
  const next = pick.linesAfter.map((l) => l.trim()).find(Boolean);
  if (!next || next === pick.value.trim() || looksLikeLabel(next, pick.value)) return [];
  return anchorFragments(next, ctx.text).map((pat) => ({
    rule: { from: 'text' as const, regex: `(?:^|\\n)[ \\t]*([^\\n]+?)[ \\t]*(?:\\n[ \\t]*)+[^\\n]*?${pat}`, group: 1 },
    strategy: 'label-after' as DerivationStrategy,
  }));
}

// Returns EVERY acceptable preceding line (nearest first), not just the first:
// the nearest line is often a per-item badge ("Plus") that fails verification
// (or drifts), and the verify loop needs the farther labels to fall back on.
function tryLabelAnchored(
  pick: PickedField,
  ctx: PickerCaptureContext,
): { rule: FieldRule; strategy: DerivationStrategy; ambiguousLabel: boolean }[] {
  const out: { rule: FieldRule; strategy: DerivationStrategy; ambiguousLabel: boolean }[] = [];
  for (let i = pick.linesBefore.length - 1; i >= 0; i--) {
    const label = pick.linesBefore[i];
    if (!looksLikeLabel(label, pick.value)) continue;
    out.push({
      rule: { from: 'text', regex: anchoredRegex(label, pick.value), group: 1 },
      strategy: 'label-anchored',
      ambiguousLabel: labelOccurrences(ctx.text, label) > 1,
    });
  }
  return out;
}

// ─── Candidate strategy 2b: inline-label ─────────────────────────────────────
//
// The value carries its own label on the SAME line: TUI's "Total Price £3952.48".
// Label = leading text up to the first currency symbol or digit; the rest must
// be money / number / date. Returns null if the line isn't that shape, or the
// label isn't label-like / is itself an unstable line.
function splitInlineLabel(line: string): { label: string; rest: string } | null {
  const t = line.trim();
  const idx = t.search(/[£$€\d]/);
  if (idx <= 0) return null;
  // A digit glued to letters ("LP31765") is part of a code, not an amount after a label.
  if (/\d/.test(t[idx]) && !/[\s:]/.test(t[idx - 1])) return null;
  const label = t.slice(0, idx).trim().replace(/\s*:$/, '').trim();
  const rest = t.slice(idx).trim();
  if (!label || !/[A-Za-z]/.test(label)) return null;
  if (inferTransform(rest) === undefined) return null;
  if (!looksLikeLabel(label, t)) return null; // also rejects unstable (money/date/...) labels
  return { label, rest };
}

// Literal label as a regex: whitespace runs become [ \t]+ (never \s, which
// would cross a line break).
function labelPattern(label: string): string {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .join('[ \\t]+');
}

// How many lines of the page START with the label (followed by `tail`).
function lineStartOccurrences(text: string, labelPat: string, tail: string): number {
  return (text.match(new RegExp(`(?:^|\\n)[ \\t]*${labelPat}${tail}`, 'gi')) ?? []).length;
}

function tryInlineLabel(
  pick: PickedField,
  ctx: PickerCaptureContext,
): { rule: FieldRule; strategy: DerivationStrategy; ambiguousLabel: boolean } | null {
  const value = pick.value.trim();
  if (!value || value.includes('\n')) return null;
  const split = splitInlineLabel(value);
  if (!split) return null;
  const pat = labelPattern(split.label);
  // Amount start built from the value's own shape (symbol kept if present).
  const symbol = /^[£$€]/.exec(split.rest)?.[0];
  const amountStart = symbol ? `${escapeRegExp(symbol)}[ \\t]*\\d` : '\\d';
  // Group 1 spans the WHOLE line from the label, so the raw capture equals the
  // picked value; the label is what anchors it, wherever the line sits.
  const regex = `(?:^|\\n)[ \\t]*(${pat}[ \\t]*:?[ \\t]*${amountStart}[^\\n]*)`;
  return {
    rule: { from: 'text', regex, group: 1 },
    strategy: 'inline-label',
    ambiguousLabel: lineStartOccurrences(ctx.text, pat, '\\b') > 1,
  };
}

// ─── Candidate strategy 2c: label-after ──────────────────────────────────────
//
// Anchors on the NEXT line when the preceding lines are per-item badges that
// change between pages. TUI's per-person "£1976.24pp" sits between hotel badges
// ("Green & Fair Hotel", "Plus") and the stable "Total Price £3952.48" line.
// Anchor = that line's stable label part (whole line if it is a label, else its
// leading label prefix). It must start exactly one line on the page, otherwise
// it can't say which occurrence is meant.
function tryLabelAfter(
  pick: PickedField,
  ctx: PickerCaptureContext,
): { rule: FieldRule; strategy: DerivationStrategy; viaInline: boolean } | null {
  const next = pick.linesAfter.map((l) => l.trim()).find(Boolean);
  if (!next || next === pick.value.trim()) return null;

  let pat: string;
  let tail: string;
  let viaInline = false;
  if (looksLikeLabel(next, pick.value)) {
    pat = labelPattern(next);
    tail = '[ \\t]*(?=\\n|$)';
  } else {
    const split = splitInlineLabel(next);
    if (!split) return null;
    pat = labelPattern(split.label);
    tail = '\\b';
    viaInline = true;
  }
  if (lineStartOccurrences(ctx.text, pat, tail) !== 1) return null;

  return {
    rule: { from: 'text', regex: `(?:^|\\n)[ \\t]*([^\\n]+?)[ \\t]*(?:\\n[ \\t]*)+${pat}${tail}`, group: 1 },
    strategy: 'label-after',
    viaInline,
  };
}

// ─── Candidate strategy 3: heading-position ──────────────────────────────────
//
// headings are read positionally, never by wording — a headline is arbitrary
// prose and unanchorable by content (this is the fix behind Carnival's title
// bug: reading the headings list by index instead of scanning page text for
// "IMPORTANT NOTICE", the second line of a site banner, instead of the second
// heading, the actual voyage name).
function tryHeadingPosition(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy } | null {
  const headings = ctx.headings ?? [];
  const index = headings.indexOf(pick.value);
  if (index === -1) return null;
  const regex = index === 0 ? '^([^\\n]+)' : `^${'[^\\n]*\\n'.repeat(index)}([^\\n]+)`;
  return { rule: { from: 'headings', regex, group: 1 }, strategy: 'heading-position' };
}

// ─── Candidate strategy 4: title-prefix ──────────────────────────────────────
//
// "<Deal name> | <Operator>" / "<Deal name> - <Operator>" is the near-universal
// <title> shape across suppliers; the deal name is the prefix before whichever
// separator this site uses.
const TITLE_SEPARATORS = ['|', '-', '–', ':', '•'];

function tryTitlePrefix(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy } | null {
  for (const sep of TITLE_SEPARATORS) {
    if (!ctx.title.includes(sep)) continue;
    const prefix = ctx.title.slice(0, ctx.title.indexOf(sep)).trim();
    if (prefix !== pick.value) continue;
    return { rule: { from: 'title', regex: `^(.*?)\\s*${escapeRegExp(sep)}`, group: 1 }, strategy: 'title-prefix' };
  }
  return null;
}

// ─── Candidate strategy 4b: title-segment ────────────────────────────────────
//
// tryTitlePrefix only ever tests segment 0. Hoseasons' title is
// "Gold 3 Caravan with parking - White Cross Bay - Lodges - Book Online -
// Hoseasons": the park name (lodge_park_name = "White Cross Bay") is segment 1,
// so title-prefix can never see it and the pick failed with no rule.
//
// Each separator is tried INDEPENDENTLY (in TITLE_SEPARATORS order) and the
// segment index is counted in THAT separator's own split. A title mixing
// separators ("A | B - C") therefore yields a rule per separator; the first one
// that verifies wins, and the rule only ever depends on one separator character,
// so a different separator elsewhere in the title can't shift the index. A
// hyphen inside a word ("Check-in") does shift a "-" split — that is caught by
// verification on THIS page, and is why confidence is 'medium', not 'high'.
// Segment 0 is skipped: title-prefix owns it and runs first.
//
// Regex: skip n separator-delimited groups with a negated class (never a
// literal title fragment), then capture the nth segment lazily up to the next
// separator or end of title.
function tryTitleSegment(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy } | null {
  for (const sep of TITLE_SEPARATORS) {
    if (!ctx.title.includes(sep)) continue;
    const segments = ctx.title.split(sep).map((s) => s.trim());
    const sepRe = escapeRegExp(sep);
    for (let n = 1; n < segments.length; n++) {
      if (segments[n] !== pick.value) continue;
      return {
        rule: { from: 'title', regex: `^(?:[^${sepRe}]*${sepRe}){${n}}\\s*([^${sepRe}]*?)\\s*(?:${sepRe}|$)`, group: 1 },
        strategy: 'title-segment',
      };
    }
  }
  return null;
}

// ─── Candidate strategy 4c: url-path-slug ─────────────────────────────────────
//
// tryUrlParam reads searchParams only. Hoseasons carries the park in the PATH:
// /agents/lodges/white-cross-bay-pwba/gold-3-caravan-with-parking-lp31765 —
// "white-cross-bay-pwba" is the park name plus a trailing park CODE (pwba, the
// same code the image URLs use). A path slug is as durable as a query param.
//
// The raw capture is a hyphenated slug, so the rule carries transform
// 'titleCase' and verification replays it (see verify). Two shapes per segment:
//   1. whole slug is the value ("white-cross-bay")
//   2. whole slug minus ONE trailing code token ("white-cross-bay-pwba")
// Over-stripping guard: only a single token is ever dropped, the remainder must
// equal the WHOLE picked value (so "gold-3-caravan-with-parking-lp31765" can
// never reduce to a shorter value like "Gold 3 Caravan"), the token must look
// like a code (2-8 alphanumerics), and it must not be a real word of the name:
// if "<value> <token>" appears in the page text ("White Cross Bay" for value
// "White Cross" + token "bay"), the token is part of the name and is not stripped.
function slugWords(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // keep the raw segment
  }
  return decoded.replace(/-+/g, ' ').trim();
}

function tryUrlPathSlug(
  pick: PickedField,
  ctx: PickerCaptureContext,
): { rule: FieldRule; strategy: DerivationStrategy; replay: 'titleCase' } | null {
  let parsed: URL;
  try {
    parsed = new URL(ctx.url);
  } catch {
    return null;
  }
  const want = pick.value.trim().toLowerCase();
  if (!want) return null;
  const segments = parsed.pathname.split('/').filter(Boolean);
  const textLower = ctx.text.toLowerCase();
  // Skips scheme+host, then n whole path segments, then the slug itself.
  const prefix = (n: number): string => `^[a-z][a-z0-9+.-]*://[^/?#]+(?:/[^/?#]+){${n}}/`;

  for (let n = 0; n < segments.length; n++) {
    const seg = segments[n];
    if (slugWords(seg).toLowerCase() === want) {
      return {
        rule: { from: 'url', regex: `${prefix(n)}([^/?#]+)`, group: 1, transform: 'titleCase' },
        strategy: 'url-path-slug',
        replay: 'titleCase',
      };
    }
    const lastHyphen = seg.lastIndexOf('-');
    if (lastHyphen <= 0) continue;
    const token = seg.slice(lastHyphen + 1);
    if (!/^[a-z0-9]{2,8}$/i.test(token)) continue;
    if (slugWords(seg.slice(0, lastHyphen)).toLowerCase() !== want) continue;
    if (textLower.includes(`${want} ${token.toLowerCase()}`)) continue; // token is a real word of the name
    return {
      rule: { from: 'url', regex: `${prefix(n)}([^/?#]+?)-[a-z0-9]{2,8}(?:[/?#]|$)`, group: 1, transform: 'titleCase' },
      strategy: 'url-path-slug',
      replay: 'titleCase',
    };
  }
  return null;
}

// ─── Candidate strategy 4d: value-pattern-line ────────────────────────────────
//
// For a value that EMBEDS ITS OWN LABEL — Hoseasons' lodge_code is picked as the
// whole line "Ref: LP31765". tryLabelAnchored captures what FOLLOWS a label, so
// it yields "LP31765" and fails verification; the line before it ("White Cross
// Bay in Lake Windermere , Cumbria") is rejected as a label (too many words)
// and, as a line-offset anchor, by findUnsafeRules' 30-char literal-run limit
// (it is 44 chars). Anchoring on a neighbour is the wrong shape: the value
// already carries its own stable anchor ("Ref:").
//
// So the pattern is built from the value's OWN shape: non-digit text is kept
// literally (escaped), every digit run becomes \d+, whitespace runs become
// [ \t]+ (never \s, which would cross a line break). "Ref: LP31765" becomes
// (?:^|\n)[ \t]*(Ref:[ \t]+LP\d+)[ \t]*(?=\n|$) — the same (?:^|\n) line anchor
// the other strategies use, since the regex runs without the 'm' flag.
//
// Avoiding OVER-generalising: (a) the literal parts stay, so on the Hoseasons
// page the bare "(LP31763)" codes can't match — "Ref:" is required; (b) the
// whole generalised pattern must match EXACTLY ONE line of the page text, else
// null — a pattern that hits several lines can't tell which is meant; (c) a
// value with no non-digit literal at all ("7", "2026") is refused outright —
// that would be bare \d+; (d) money/date/integer shaped values are refused so
// this can never route a price around the label-anchored/PRICE_ZERO path.
// Avoiding UNDER-generalising: digit runs are never pinned to the picked digits
// ("LP31765" -> LP\d+), which a regex of the exact string would be. A letter
// prefix is kept literal on purpose — widening it to [A-Z]+ would start matching
// unrelated codes. Verification still replays the rule against this page.
function tryValuePatternLine(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy } | null {
  const value = pick.value.trim();
  if (!value || value.includes('\n')) return null;
  if (inferTransform(value) !== undefined) return null; // money / date / bare integer — not this strategy's job
  if (!/\d/.test(value)) return null; // nothing to generalise — a plain literal line is just a hardcoded string
  if (!/[^\d\s]/.test(value)) return null; // needs a literal non-digit part, otherwise the pattern degenerates to \d+
  const lines = ctx.text.split(/\r?\n/).map((l) => l.trim());
  if (!lines.includes(value)) return null; // only for a value that is a whole line

  const body = (value.match(/\d+|\s+|[^\d\s]+/g) ?? [])
    .map((tok) => (/^\d+$/.test(tok) ? '\\d+' : /^\s+$/.test(tok) ? '[ \\t]+' : escapeRegExp(tok)))
    .join('');
  const regex = `(?:^|\\n)[ \\t]*(${body})[ \\t]*(?=\\n|$)`;

  let lineRe: RegExp;
  try {
    lineRe = new RegExp(`^${body}$`, 'i');
  } catch {
    return null;
  }
  if (lines.filter((l) => lineRe.test(l)).length !== 1) return null; // not unique on the page

  return { rule: { from: 'text', regex, group: 1 }, strategy: 'value-pattern-line' };
}

// ─── Candidate strategy 5: line-offset (last resort) ─────────────────────────
//
// No label, no heading, no title, no URL param — the only anchor left is
// "whatever line came before it", which is only safe to use when that exact
// line occurs NOWHERE else on the page; otherwise the rule is positional
// against an anchor that itself isn't unique, and will drift onto a different
// occurrence the moment page order shifts. Always 'low' confidence (see
// deriveConfidence) — this is the fallback the audit's §3 warns is
// provisional, not the fallback that should be trusted across pages.
function tryLineOffset(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy }[] {
  const out: { rule: FieldRule; strategy: DerivationStrategy }[] = [];
  for (let i = pick.linesBefore.length - 1; i >= 0; i--) {
    const anchor = pick.linesBefore[i];
    if (!anchor.trim() || isUnstableAnchorLine(anchor.trim())) continue;
    const occurrences = (ctx.text.match(new RegExp(`(?:^|\\n)\\s*${escapeRegExp(anchor)}\\s*\\n`, 'g')) ?? []).length;
    if (occurrences !== 1) continue; // not unique — can't trust it as a positional anchor
    // Every unique anchor is a candidate (nearest first): if the nearest one
    // fails verification the farther ones still get their turn.
    out.push({
      rule: { from: 'text', regex: anchoredRegex(anchor, pick.value), group: 1 },
      strategy: 'line-offset',
    });
  }
  return out;
}

// ─── Transform inference ─────────────────────────────────────────────────────
//
// Inferred from the picked GROUND-TRUTH value, not from the regex — the rule
// itself always captures the raw substring (that's what was verified above);
// the transform is what the interpreter applies to it afterwards, at read
// time, exactly as it does for AI-generated specs.
// Deliberately NOT anchored with ^ — a picked money value very often carries
// its label along with it ("Total Price £2124.06", not a bare "£2124.06"),
// because the picker captures the element's whole visible text, not just the
// digits. Anchoring at the start missed every one of those and left the rule
// with no transform at all, so applyTransform's 'number' branch (which DOES
// parse a labelled amount fine) never even ran — the price silently became 0
// downstream. A currency symbol immediately followed by a digit is a strong
// enough signal on its own that it's safe to look for anywhere in the value;
// none of the non-money shapes this must keep rejecting ("Deck 12, Cabin
// 4021", "Flight BA2490", "Room 2", "2 adults") contain a £/$/€ at all.
const MONEY_SYMBOL_RE = /[£$€]\s?\d/;
const MONEY_THOUSANDS_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_NUMERIC_RE = /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/;
const DATE_DAY_MONTH_YEAR_RE = /^\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}$/;
const DATE_MONTH_DAY_YEAR_RE = /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/;
const INTEGER_RE = /^\d+$/;

// Party-size counts. Besides a bare "1", a supplier often prints the count with
// its unit ("1 Child", "2 Children", "1 infant"); a rule capturing that must
// still yield the number, so a single small integer wrapped in non-digits gets
// the 'number' transform for these fields only (everywhere else such a value —
// "Room 2", "7 nights" — deliberately stays an untouched string).
const PARTY_COUNT_FIELDS = new Set(['adults', 'children', 'infants']);
const PARTY_COUNT_RE = /^\D*\d{1,2}\D*$/;

function inferTransform(value: string, field?: string): FieldTransform | undefined {
  const v = value.trim();
  if (field && PARTY_COUNT_FIELDS.has(field) && PARTY_COUNT_RE.test(v)) return 'number';
  if (MONEY_SYMBOL_RE.test(v) || MONEY_THOUSANDS_RE.test(v)) return 'number';
  if (DATE_ISO_RE.test(v) || DATE_NUMERIC_RE.test(v) || DATE_DAY_MONTH_YEAR_RE.test(v) || DATE_MONTH_DAY_YEAR_RE.test(v)) return 'date';
  if (INTEGER_RE.test(v)) return 'number'; // a bare integer count, e.g. "7" nights or "2" adults
  return undefined;
}

// ─── Candidate strategy: party-count ─────────────────────────────────────────
//
// Adults, children and infants often share ONE element ("Travelers: 2 adults
// and 1 child"). A whole-line capture with the 'number' transform reads the
// FIRST number only, so only adults could ever be right. This strategy instead
// captures just the number next to THIS field's party word, and a single pick
// also yields rules for the sibling party fields (see derivePartySiblings).
type PartyField = 'adults' | 'children' | 'infants';
const PARTY_ORDER: PartyField[] = ['adults', 'children', 'infants'];
const PARTY_WORDS: Record<PartyField, string> = {
  adults: 'adults?|adt',
  children: 'children|child|kids?|chd',
  infants: 'infants?|babies|baby|inf',
};
const ALL_PARTY_WORDS = PARTY_ORDER.map((f) => PARTY_WORDS[f]).join('|');

type PartyStyle = 'number-before' | 'word-before';

function isPartyField(field: string): field is PartyField {
  return field === 'adults' || field === 'children' || field === 'infants';
}

function partyCapture(field: PartyField, style: PartyStyle): string {
  const w = PARTY_WORDS[field];
  return style === 'number-before' ? `\\b(\\d{1,2})[ \\t]*(?:${w})\\b` : `\\b(?:${w})\\b[ \\t]*:?[ \\t]*(\\d{1,2})\\b`;
}

interface PartyPlan {
  style: PartyStyle;
  counts: Partial<Record<PartyField, number>>;
  multi: boolean; // 2+ distinct party tokens on the line
  labelPat: string | null; // stable leading label as a regex, if any
}

// Reads the party tokens off a single-line picked value. The style is decided
// once per line (the first party word is preceded by its number -> "2 adults",
// otherwise "Adults: 2"), so "Adults: 2 Children: 1" can't be misread as
// "2 Children".
function planParty(value: string): PartyPlan | null {
  const v = value.trim();
  if (!v || v.includes('\n')) return null;
  const firstWord = new RegExp(`\\b(?:${ALL_PARTY_WORDS})\\b`, 'i').exec(v);
  if (!firstWord) return null;
  const style: PartyStyle = /\d[ \t]*$/.test(v.slice(0, firstWord.index)) ? 'number-before' : 'word-before';
  const counts: Partial<Record<PartyField, number>> = {};
  for (const f of PARTY_ORDER) {
    const m = new RegExp(partyCapture(f, style), 'i').exec(v);
    if (m) counts[f] = Number(m[1]);
  }
  const tokenCount = Object.keys(counts).length;
  if (tokenCount === 0) return null;

  const cut = Math.min(firstWord.index, v.search(/\d/) === -1 ? v.length : v.search(/\d/));
  const label = v.slice(0, cut).trim().replace(/\s*:$/, '').trim();
  const labelPat = label && /[A-Za-z]/.test(label) && looksLikeLabel(label, v) ? labelPattern(label) : null;
  return { style, counts, multi: tokenCount >= 2, labelPat };
}

function partyRule(field: PartyField, plan: PartyPlan): FieldRule | null {
  let lead: string;
  if (plan.labelPat) {
    lead = `${plan.labelPat}[^\\n]*?`;
  } else {
    // No stable label: the line must visibly be a party line, i.e. also carry
    // another party word, or the rule would match any "1 child" on the page.
    if (!plan.multi) return null;
    const others = PARTY_ORDER.filter((f) => f !== field)
      .map((f) => PARTY_WORDS[f])
      .join('|');
    lead = `(?=[^\\n]*\\b(?:${others})\\b)[^\\n]*?`;
  }
  return { from: 'text', regex: `(?:^|\\n)[ \\t]*${lead}${partyCapture(field, plan.style)}`, group: 1, transform: 'number' };
}

// The captured number must equal the count parsed from the picked value; a
// party word that is absent from the value must NOT match anywhere (that is
// the "0" the rule reports on this page).
function verifyParty(rule: FieldRule, ctx: { title: string; text: string; url: string; headingsText: string }, expected: number | undefined): boolean {
  const raw = extractRaw(rule, ctx);
  if (expected === undefined) return raw === null;
  return raw !== null && Number(raw.trim()) === expected;
}

function tryPartyCount(
  pick: PickedField,
): { rule: FieldRule; strategy: DerivationStrategy; partyExpected: number; plan: PartyPlan } | null {
  if (!isPartyField(pick.field)) return null;
  const plan = planParty(pick.value);
  if (!plan) return null;
  const expected = plan.counts[pick.field];
  if (expected === undefined) return null;
  const rule = partyRule(pick.field, plan);
  if (!rule) return null;
  return { rule, strategy: 'party-count', partyExpected: expected, plan };
}

// One pick fills all three: rules for the OTHER party fields from the same
// multi-party line, unless the agent picked that field separately.
function derivePartySiblings(
  plan: PartyPlan,
  pickedField: PartyField,
  skip: Set<string>,
  runtimeCtx: { title: string; text: string; url: string; headingsText: string },
  pickedAt: string,
): DerivedRule[] {
  if (!plan.multi) return [];
  const out: DerivedRule[] = [];
  for (const f of PARTY_ORDER) {
    if (f === pickedField || skip.has(f)) continue;
    const base = partyRule(f, plan);
    if (!base) continue;
    const expected = plan.counts[f];
    if (!verifyParty(base, runtimeCtx, expected)) continue;
    if (!passesSafetyChecks(f, base)) continue;
    out.push({
      field: f,
      rule: { ...base, origin: 'picked', verifiedValue: String(expected ?? 0), strategy: 'party-count', pickedAt },
      strategy: 'party-count',
      confidence: plan.labelPat ? 'high' : 'medium',
    });
  }
  return out;
}

// ─── Confidence ───────────────────────────────────────────────────────────────
function deriveConfidence(
  strategy: DerivationStrategy,
  pick: PickedField,
  extra: { ambiguousLabel?: boolean; unlabeledParty?: boolean; fragment?: boolean },
): 'high' | 'medium' | 'low' {
  // An anchor that is only a SLICE of a longer line is never 'high'.
  if (extra.fragment) return deriveConfidence(strategy, pick, { ...extra, fragment: false }) === 'low' ? 'low' : 'medium';
  if (strategy === 'party-count') return extra.unlabeledParty ? 'medium' : 'high';
  if (strategy === 'line-offset') return 'low';
  // title-segment: titles are stable across redesigns but segment order can
  // shift. value-pattern-line: generalised from ONE example, anchored on the
  // value's own literal label, unique-on-page checked.
  if (strategy === 'heading-position' || strategy === 'title-prefix' || strategy === 'title-segment' || strategy === 'value-pattern-line') return 'medium';
  if (strategy === 'url-param' || strategy === 'url-path-slug') return 'high';
  if (strategy === 'label-after') return pick.occurrenceCount > 1 ? 'low' : 'medium';
  // inline-label: the label is the value's own prefix; 'low' only if that label
  // starts more than one line on the page.
  if (strategy === 'inline-label') return extra.ambiguousLabel ? 'low' : 'high';
  // label-anchored: 'high' unless the anchor label itself repeats on the page
  // (occurrenceCount > 1 with a repeating label is exactly the shape that
  // can't tell which occurrence is meant — the "Taxes and fees" bug).
  if (extra.ambiguousLabel && pick.occurrenceCount > 1) return 'low';
  return 'high';
}

// ─── Flights section (the "flights_section" pick) ────────────────────────────
//
// The agent clicks the box wrapping ALL flight legs. Unlike every other pick this
// is not a value to extract but a REGION to read: the result is stored on
// spec.flightsSection (NOT in `fields`) as a start heading (and optionally an end
// heading) that extractFlightsSection uses to cut the same region out of any
// later capture. Labels must be stable copy, never values — a "Wed 12 May" line
// would break the next day.
export const FLIGHTS_SECTION_FIELD = 'flights_section';
// Direction-specific variants for pages laid out outbound flight -> hotel -> return flight.
export const FLIGHTS_OUTBOUND_SECTION_FIELD = 'flights_outbound_section';
export const FLIGHTS_RETURN_SECTION_FIELD = 'flights_return_section';
// A cruise's day-by-day itinerary box: located the same way (heading labels), stored
// on spec.itinerarySection.
export const ITINERARY_SECTION_FIELD = 'itinerary_section';
type SectionKind = 'combined' | 'outbound' | 'return' | 'itinerary';
const SECTION_FIELDS: Record<string, SectionKind> = {
  [FLIGHTS_SECTION_FIELD]: 'combined',
  [FLIGHTS_OUTBOUND_SECTION_FIELD]: 'outbound',
  [FLIGHTS_RETURN_SECTION_FIELD]: 'return',
  [ITINERARY_SECTION_FIELD]: 'itinerary',
};
const FLIGHTS_SECTION_SAMPLE_CHARS = 2000;

// A bare leg marker ("OUT", "RTN") repeats once per leg, so it can't locate the section.
const LEG_MARKER_RE = /^(?:out|rtn|ret|outbound|outward|return|inbound|inward)$/i;

// `allowLegMarker`: a DIRECTION section's heading is often exactly "Return"/"Outbound",
// which is the right label there (it is unique to its own section).
function isStableSectionLine(line: string, allowLegMarker = false): boolean {
  const t = line.trim();
  return t.length >= 4 && t.length <= 80 && /[A-Za-z]{3,}/.test(t) && !/^\d+$/.test(t) && (allowLegMarker || !LEG_MARKER_RE.test(t)) && !isUnstableAnchorLine(t);
}

function nonEmptyLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

type FlightsSectionSource = 'text' | 'flightsText' | 'deepText';

// Finds the picked block inside one source's lines by its first and last
// non-empty lines. The last line often repeats (a carrier on every card), so of
// the candidates after the first line the one whose span is closest to the
// block's own line count wins. Returns indexes into `lines`, or null.
function locateBlock(lines: string[], blockLines: string[]): { start: number; end: number } | null {
  const first = blockLines[0];
  const last = blockLines[blockLines.length - 1];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== first) continue;
    let best = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    let seen = 0;
    for (let j = i; j < lines.length && seen < blockLines.length * 3 + 20; j++) {
      if (lines[j]) seen++;
      if (j === i && blockLines.length > 1) continue;
      if (lines[j] !== last) continue;
      const span = lines.slice(i, j + 1).filter(Boolean).length;
      const diff = Math.abs(span - blockLines.length);
      if (diff < bestDiff) {
        best = j;
        bestDiff = diff;
      }
    }
    if (best >= 0) return { start: i, end: best };
  }
  return null;
}

// Derives labels from ONE source's own lines (the bookmarklet's linesBefore /
// linesAfter were computed against `text` only, and on some pages the cards
// exist solely in deepText).
function deriveFromSource(
  source: FlightsSectionSource,
  sourceText: string,
  pick: PickedField,
  blockLines: string[],
  kind: SectionKind,
): { section: FlightsSectionSpec } | { reason: string } {
  const direction = kind === 'outbound' || kind === 'return';
  const noun = kind === 'itinerary' ? 'itinerary' : 'flights';
  // No label of ANY kind may carry a digit: "Transport:  VS25" or "... - VS 25" is one deal's flight number.
  const labelOk = (l: string): boolean => isStableSectionLine(l, direction) && !/\d/.test(l);
  const lines = sourceText.split(/\r?\n/).map((l) => l.trim());
  const where = locateBlock(lines, blockLines);
  if (!where) return { reason: `the picked block was not found in the ${source}` };

  const count = (label: string): number => {
    const want = label.toLowerCase();
    return lines.filter((l) => l.toLowerCase() === want).length;
  };

  // Start headings, best first: the block's own first line, then the nearest
  // stable lines above it (looking back a bounded distance).
  const raw: string[] = [];
  if (looksLikeLabel(blockLines[0], pick.value) && labelOk(blockLines[0])) raw.push(blockLines[0]);
  for (let i = where.start - 1; i >= 0 && i >= where.start - 25; i--) {
    if (labelOk(lines[i])) raw.push(lines[i]);
  }
  if (raw.length === 0) {
    return { reason: `couldn't find a stable heading for the ${noun} section — pick the box including its heading` };
  }
  const startCandidates = raw.filter((l) => count(l) === 1);
  if (startCandidates.length === 0) {
    return { reason: `the heading "${raw[0]}" appears more than once on the page, so it can't locate the ${noun} section — pick the box including a unique heading` };
  }

  // End heading: nearest stable, unique line after the block.
  let endLabel: string | undefined;
  for (let i = where.end + 1; i < lines.length && i <= where.end + 25; i++) {
    if (labelOk(lines[i]) && count(lines[i]) === 1) {
      endLabel = lines[i];
      break;
    }
  }

  const first = blockLines[0];
  const last = blockLines[blockLines.length - 1];
  const covers = (startLabel: string, end: string | undefined): boolean => {
    const probe: FlightsSectionSpec = { startLabel, endLabel: end, origin: 'picked', pickedAt: '', source, blockLines: blockLines.length };
    const cut =
      kind === 'itinerary'
        ? extractItinerarySection({ itinerarySection: probe }, { [source]: sourceText })
        : extractFlightsSection(
            kind === 'outbound' ? { flightsOutboundSection: probe } : kind === 'return' ? { flightsReturnSection: probe } : { flightsSection: probe },
            { [source]: sourceText },
            kind,
          );
    if (!cut) return false;
    const got = new Set(nonEmptyLines(cut));
    return got.has(first) && got.has(last);
  };

  for (const startLabel of startCandidates) {
    const useEnd = endLabel && endLabel.toLowerCase() !== startLabel.toLowerCase() && covers(startLabel, endLabel);
    if (useEnd || covers(startLabel, undefined)) {
      return {
        section: {
          startLabel,
          ...(useEnd ? { endLabel } : {}),
          origin: 'picked',
          pickedAt: new Date().toISOString(),
          sampleText: pick.value.slice(0, FLIGHTS_SECTION_SAMPLE_CHARS),
          source,
          ...(direction ? { blockLines: blockLines.length } : {}),
        },
      };
    }
  }
  return { reason: `locating the section by its heading "${startCandidates[0]}" did not reproduce the picked ${noun} block in the ${source}` };
}

function deriveFlightsSection(
  pick: PickedField,
  ctx: PickerCaptureContext,
  kind: SectionKind,
): { section: FlightsSectionSpec } | { problem: string } {
  const blockLines = nonEmptyLines(pick.value);
  const noun = kind === 'itinerary' ? 'itinerary' : 'flights';
  if (blockLines.length === 0) return { problem: `the picked ${noun} section was empty` };

  // Same order the runtime lookup uses. The first source that both contains the
  // block and yields a verified heading wins, and is remembered on the section.
  const sources: [FlightsSectionSource, string | undefined][] = [
    ['text', ctx.text],
    ['flightsText', ctx.flightsText],
    ['deepText', ctx.deepText],
  ];
  const reasons: string[] = [];
  for (const [name, content] of sources) {
    if (!content) continue;
    const outcome = deriveFromSource(name, content, pick, blockLines, kind);
    if ('section' in outcome) return outcome;
    reasons.push(outcome.reason);
  }
  // Prefer a reason that says WHY a located block failed over a plain "not found".
  const informative = reasons.find((r) => !r.includes('was not found in'));
  return { problem: informative ?? reasons[0] ?? `the picked ${noun} block was not found in the captured page` };
}

// ─── Label-led multi-line picks ──────────────────────────────────────────────
//
// An agent often grabs the block holding a label AND its value ("Nights\n5").
// Rules capture a single line, so the whole picked string can never be
// reproduced; what the field wants is the remainder. Applies only when the pick
// is exactly two non-empty lines and the first looks like a label (the same
// looksLikeLabel every anchor uses). The result is a pick for the REMAINDER with
// the label as its nearest preceding line. Never reached for the *_section
// fields: those are dispatched through SECTION_FIELDS (whole-block region
// derivation) before this runs. Anything else multi-line is left untouched and
// fails with the normal no-candidate reason.
function splitLabelLedPick(pick: PickedField): PickedField | null {
  if (!pick.value.includes('\n')) return null;
  const lines = nonEmptyLines(pick.value);
  if (lines.length !== 2) return null;
  const [label, remainder] = lines;
  if (!looksLikeLabel(label, remainder)) return null;
  return { ...pick, value: remainder, linesBefore: [...pick.linesBefore, label] };
}

// ─── Main entry point ────────────────────────────────────────────────────────
export function deriveSpecFromPicks(picks: PickedField[], ctx: PickerCaptureContext): PickerSpecResult {
  const headingsText = (ctx.headings ?? []).join('\n');
  const runtimeCtx = { title: ctx.title, text: ctx.text, url: ctx.url, headingsText };

  const derived: DerivedRule[] = [];
  const problems: DerivationProblem[] = [];
  const pickedFieldNames = new Set(picks.map((p) => p.field));

  let flightsSection: ExtractionSpec['flightsSection'];
  let flightsOutboundSection: ExtractionSpec['flightsOutboundSection'];
  let flightsReturnSection: ExtractionSpec['flightsReturnSection'];
  let itinerarySection: ExtractionSpec['itinerarySection'];

  for (const original of picks) {
    // A region, not a value: derived on its own and stored under
    // spec.flightsSection (never in `fields`), so none of the value strategies
    // below apply and it needs no textIndex of its own. This dispatch happens
    // BEFORE the label-led multi-line handling, so *_section picks never see it.
    const sectionKind = SECTION_FIELDS[original.field];
    if (sectionKind) {
      const outcome = deriveFlightsSection(original, ctx, sectionKind);
      if ('problem' in outcome) problems.push({ field: original.field, reason: outcome.problem });
      else if (sectionKind === 'outbound') flightsOutboundSection = outcome.section;
      else if (sectionKind === 'return') flightsReturnSection = outcome.section;
      else if (sectionKind === 'itinerary') itinerarySection = outcome.section;
      else flightsSection = outcome.section;
      continue;
    }

    // An unlocatable pick has no position in the page to anchor against at
    // all — trying to guess a rule from a label/heading/url alone, without
    // ever having confirmed the value actually sits where claimed, is exactly
    // the unverified-guess failure mode this module exists to prevent. Report
    // it and move on rather than emit a rule with nothing behind it.
    if (original.textIndex === -1) {
      problems.push({ field: original.field, reason: `pick could not be located in the captured page text (textIndex: -1) — no rule can be verified without a position to anchor against` });
      continue;
    }

    // "Nights\n5" -> pick for "5" anchored on "Nights" (see splitLabelLedPick).
    // `original` is kept for messages; `pick` is what the strategies work on.
    const labelLed = splitLabelLedPick(original);
    const pick = labelLed ?? original;

    type Candidate = {
      rule: FieldRule;
      strategy: DerivationStrategy;
      ambiguousLabel?: boolean;
      replay?: 'titleCase';
      partyExpected?: number;
      partyPlan?: PartyPlan;
      fragment?: boolean;
    };
    const candidates: Candidate[] = [];
    if (labelLed) {
      // Only the rule anchored on the block's own label (the nearest preceding
      // line) is a candidate: url/title/heading matches on a bare "5" would be
      // accidents, not derivations.
      candidates.push(...tryLabelAnchored(pick, ctx).slice(0, 1));
    } else {
      // A multi-party line ("2 adults and 1 child") goes through party-count
      // FIRST; a single token keeps the older order and only falls back to it.
      const partyCount = tryPartyCount(pick);
      if (partyCount && partyCount.plan.multi) candidates.push({ ...partyCount, partyPlan: partyCount.plan });
      const urlParam = tryUrlParam(pick, ctx);
      if (urlParam) candidates.push(urlParam);
      // A label-after whose anchor is a "Label £amount" line outranks preceding-line
      // labels: those are often per-item badges that merely happen to verify on this
      // one page ("Plus"). A plain label-line anchor ranks after title/url instead.
      const labelAfter = tryLabelAfter(pick, ctx);
      if (labelAfter?.viaInline) candidates.push(labelAfter);
      candidates.push(...tryLabelAnchored(pick, ctx));
      const inlineLabel = tryInlineLabel(pick, ctx);
      if (inlineLabel) candidates.push(inlineLabel);
      const headingPosition = tryHeadingPosition(pick, ctx);
      if (headingPosition) candidates.push(headingPosition);
      const titlePrefix = tryTitlePrefix(pick, ctx);
      if (titlePrefix) candidates.push(titlePrefix);
      // New strategies go AFTER the original ones above so any pick that already
      // resolved keeps its rule; they only widen what can be derived.
      // url-path-slug ('high') is tried before title-segment ('medium'), and
      // value-pattern-line before the 'low' line-offset fallback.
      const urlPathSlug = tryUrlPathSlug(pick, ctx);
      if (urlPathSlug) candidates.push(urlPathSlug);
      const titleSegment = tryTitleSegment(pick, ctx);
      if (titleSegment) candidates.push(titleSegment);
      if (labelAfter && !labelAfter.viaInline) candidates.push(labelAfter);
      const valuePatternLine = tryValuePatternLine(pick, ctx);
      if (valuePatternLine) candidates.push(valuePatternLine);
      if (partyCount && !partyCount.plan.multi) candidates.push({ ...partyCount, partyPlan: partyCount.plan });
      candidates.push(...tryLineOffset(pick, ctx));
      // Last of all: short-fragment anchors for long neighbour lines (see
      // anchorFragments), appended after every older candidate so picks that
      // already resolved keep their rule.
      for (const f of [...tryLabelAnchoredFragments(pick, ctx), ...tryLabelAfterFragments(pick, ctx)]) {
        candidates.push({ ...f, fragment: true });
      }
    }

    let winner: Candidate | null = null;
    for (const candidate of candidates) {
      const ok =
        candidate.strategy === 'party-count'
          ? verifyParty(candidate.rule, runtimeCtx, candidate.partyExpected)
          : verify(candidate.rule, runtimeCtx, pick.value, candidate.replay);
      if (!ok) continue;
      if (!passesSafetyChecks(pick.field, candidate.rule)) continue;
      winner = candidate;
      break; // candidates are already in priority order — first verified wins
    }

    if (!winner) {
      problems.push({
        field: pick.field,
        reason: `no candidate strategy (url-param, label-anchored, inline-label, label-after, heading-position, title-prefix, title-segment, url-path-slug, value-pattern-line, party-count, line-offset) produced a rule that reproduces the picked value "${original.value}" against the captured page`,
      });
      continue;
    }

    const transform = winner.rule.transform ?? inferTransform(pick.value, pick.field);
    // Provenance (extraction.types.ts, EXTRACTION_AUDIT.md §4 Phase 3): stamp
    // every rule this module emits as human-verified, with the exact value
    // confirmed, which strategy produced it and when. This is what
    // mergePickedIntoSpec's `replaced` reporting and the review UI use to
    // distinguish a click-verified rule from an AI guess — without it, a
    // merged spec has no way to tell them apart after the fact.
    const rule: FieldRule = {
      ...winner.rule,
      ...(transform ? { transform } : {}),
      origin: 'picked',
      verifiedValue: pick.value,
      strategy: winner.strategy,
      pickedAt: new Date().toISOString(),
    };
    derived.push({
      field: pick.field,
      rule,
      strategy: winner.strategy,
      confidence: deriveConfidence(winner.strategy, pick, {
        ambiguousLabel: winner.ambiguousLabel,
        fragment: winner.fragment,
        unlabeledParty: winner.partyPlan ? winner.partyPlan.labelPat === null : false,
      }),
    });

    // One pick fills all three: sibling party rules from the same line, for
    // fields the agent did not pick separately in this batch.
    if (winner.strategy === 'party-count' && winner.partyPlan && isPartyField(pick.field)) {
      for (const sibling of derivePartySiblings(winner.partyPlan, pick.field, pickedFieldNames, runtimeCtx, rule.pickedAt ?? new Date().toISOString())) {
        if (!derived.some((d) => d.field === sibling.field)) derived.push(sibling);
      }
    }
  }

  const spec: ExtractionSpec = {
    version: 1,
    fields: Object.fromEntries(derived.map((d) => [d.field, d.rule])),
    ...(ctx.packageType ? { packageType: ctx.packageType } : {}),
    ...(flightsSection ? { flightsSection } : {}),
    ...(flightsOutboundSection ? { flightsOutboundSection } : {}),
    ...(flightsReturnSection ? { flightsReturnSection } : {}),
    ...(itinerarySection ? { itinerarySection } : {}),
  };

  return { spec, derived, problems };
}

// ─── Merging picked fields into a supplier's stored spec ─────────────────────
//
// deriveSpecFromPicks above only ever sees the fields an agent actually
// clicked — it has no visibility into the rest of the supplier's spec, so its
// output is `{ version, fields: <only what was picked> }` and NOTHING else.
// Storing that wholesale would DELETE, for every field the agent didn't pick:
// the AI's rules for those fields, `constants` (tour_operator lives there),
// `wait.textMatches` (the CAPTURE_INCOMPLETE validation check in
// extraction.validate.ts re-applies it as a post-hoc capture gate — losing it
// silently disables that check), `itineraryRegex`, `luggageRegex`, and the
// image config (`imageUrlIncludes`/`imageContainerIncludes`). A field picker
// that quietly wiped nine-tenths of a working spec because an agent picked
// two fields would be worse than not having a picker at all.
//
// The fix is to MERGE: start from the existing spec, and overwrite only the
// field keys the picker produced. Spreading `existing` first (rather than an
// explicit allow-list of "keys to keep") means a spec-level key added to
// ExtractionSpec later is preserved automatically — the same drift class that
// silently dropped `imageContainerIncludes` and the "headings"/"deepText"
// sources (see extraction-ai.service.ts) happens whenever someone maintains a
// hand-written list instead of trusting the object itself.
export function mergePickedIntoSpec(existing: ExtractionSpec | undefined, picked: ExtractionSpec, derived: DerivedRule[]): MergeResult {
  const base: ExtractionSpec = existing ? { ...existing } : { version: 1, fields: {} };
  const mergedFields: Record<string, FieldRule> = { ...base.fields };

  const applied: MergeResult['applied'] = [];
  for (const d of derived) {
    const previous = base.fields[d.field];
    // A rule with no `origin` predates this feature and was AI-generated —
    // undefined and 'generated' are deliberately indistinguishable here (see
    // extraction.types.ts's comment on FieldRule.origin), so anything that
    // isn't explicitly 'picked' is reported as 'generated'.
    const replaced: 'generated' | 'picked' | null = !previous ? null : previous.origin === 'picked' ? 'picked' : 'generated';
    mergedFields[d.field] = d.rule;
    applied.push({
      field: d.field,
      strategy: d.strategy,
      confidence: d.confidence,
      verifiedValue: d.rule.verifiedValue ?? '',
      replaced,
    });
  }

  // A derived flights section (combined or per direction) replaces whatever the
  // stored spec had under the same key.
  const sectionKeys = [
    ['flightsSection', FLIGHTS_SECTION_FIELD],
    ['flightsOutboundSection', FLIGHTS_OUTBOUND_SECTION_FIELD],
    ['flightsReturnSection', FLIGHTS_RETURN_SECTION_FIELD],
    ['itinerarySection', ITINERARY_SECTION_FIELD],
  ] as const;
  const mergedSections: Partial<Pick<ExtractionSpec, 'flightsSection' | 'flightsOutboundSection' | 'flightsReturnSection' | 'itinerarySection'>> = {};
  for (const [key, field] of sectionKeys) {
    const derivedSection = picked[key];
    if (!derivedSection) continue;
    mergedSections[key] = derivedSection;
    applied.push({
      field,
      strategy: 'section-anchor',
      confidence: 'high',
      verifiedValue: derivedSection.startLabel,
      replaced: base[key] ? 'picked' : null,
    });
  }

  const spec: ExtractionSpec = {
    ...base,
    fields: mergedFields,
    ...mergedSections,
    // The agent declares the package type up front when arming the picker
    // (PickerCaptureContext.packageType above), which is more current than
    // whatever the stored spec previously inferred or was told — so it wins
    // when present. Leaving the existing spec's packageType alone when the
    // agent didn't declare one keeps this consistent with "overwrite only
    // what the picker actually produced".
    ...(picked.packageType ? { packageType: picked.packageType } : {}),
  };

  // Every spec-level key kept from `existing`, for the caller to show what
  // survived. `fields` isn't reported here (it was just merged above, not
  // simply "kept"), nor is `version` (structural, not content); `packageType`
  // is excluded only when the pick actually overwrote it.
  const preserved = existing
    ? Object.keys(existing).filter((key) => key !== 'version' && key !== 'fields' && (key !== 'packageType' || !picked.packageType) && !(key in mergedSections))
    : [];

  return { spec, applied, preserved };
}
