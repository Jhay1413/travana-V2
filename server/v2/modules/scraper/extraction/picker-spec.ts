import type { ExtractionSpec, FieldRule, FieldSource, FieldTransform } from './extraction.types';
import { findUnsafeRules } from './extraction-ai.service';

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

export type DerivationStrategy = 'url-param' | 'label-anchored' | 'heading-position' | 'title-prefix' | 'line-offset';

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

function verify(rule: FieldRule, ctx: { title: string; text: string; url: string; headingsText: string }, expected: string): boolean {
  return extractRaw(rule, ctx) === expected;
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
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 5;
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

function tryLabelAnchored(
  pick: PickedField,
  ctx: PickerCaptureContext,
): { rule: FieldRule; strategy: DerivationStrategy; ambiguousLabel: boolean } | null {
  for (let i = pick.linesBefore.length - 1; i >= 0; i--) {
    const label = pick.linesBefore[i];
    if (!looksLikeLabel(label, pick.value)) continue;
    return {
      rule: { from: 'text', regex: `(?:^|\\n)\\s*${escapeRegExp(label)}\\s*\\n+\\s*([^\\n]+)`, group: 1 },
      strategy: 'label-anchored',
      ambiguousLabel: labelOccurrences(ctx.text, label) > 1,
    };
  }
  return null;
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

// ─── Candidate strategy 5: line-offset (last resort) ─────────────────────────
//
// No label, no heading, no title, no URL param — the only anchor left is
// "whatever line came before it", which is only safe to use when that exact
// line occurs NOWHERE else on the page; otherwise the rule is positional
// against an anchor that itself isn't unique, and will drift onto a different
// occurrence the moment page order shifts. Always 'low' confidence (see
// deriveConfidence) — this is the fallback the audit's §3 warns is
// provisional, not the fallback that should be trusted across pages.
function tryLineOffset(pick: PickedField, ctx: PickerCaptureContext): { rule: FieldRule; strategy: DerivationStrategy } | null {
  for (let i = pick.linesBefore.length - 1; i >= 0; i--) {
    const anchor = pick.linesBefore[i];
    if (!anchor.trim()) continue;
    const occurrences = (ctx.text.match(new RegExp(`(?:^|\\n)\\s*${escapeRegExp(anchor)}\\s*\\n`, 'g')) ?? []).length;
    if (occurrences !== 1) continue; // not unique — can't trust it as a positional anchor
    return {
      rule: { from: 'text', regex: `(?:^|\\n)\\s*${escapeRegExp(anchor)}\\s*\\n+\\s*([^\\n]+)`, group: 1 },
      strategy: 'line-offset',
    };
  }
  return null;
}

// ─── Transform inference ─────────────────────────────────────────────────────
//
// Inferred from the picked GROUND-TRUTH value, not from the regex — the rule
// itself always captures the raw substring (that's what was verified above);
// the transform is what the interpreter applies to it afterwards, at read
// time, exactly as it does for AI-generated specs.
const MONEY_SYMBOL_RE = /^[£$€]\s?\d/;
const MONEY_THOUSANDS_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_NUMERIC_RE = /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/;
const DATE_DAY_MONTH_YEAR_RE = /^\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}$/;
const DATE_MONTH_DAY_YEAR_RE = /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/;
const INTEGER_RE = /^\d+$/;

function inferTransform(value: string): FieldTransform | undefined {
  const v = value.trim();
  if (MONEY_SYMBOL_RE.test(v) || MONEY_THOUSANDS_RE.test(v)) return 'number';
  if (DATE_ISO_RE.test(v) || DATE_NUMERIC_RE.test(v) || DATE_DAY_MONTH_YEAR_RE.test(v) || DATE_MONTH_DAY_YEAR_RE.test(v)) return 'date';
  if (INTEGER_RE.test(v)) return 'number'; // a bare integer count, e.g. "7" nights or "2" adults
  return undefined;
}

// ─── Confidence ───────────────────────────────────────────────────────────────
function deriveConfidence(
  strategy: DerivationStrategy,
  pick: PickedField,
  extra: { ambiguousLabel?: boolean },
): 'high' | 'medium' | 'low' {
  if (strategy === 'line-offset') return 'low';
  if (strategy === 'heading-position' || strategy === 'title-prefix') return 'medium';
  if (strategy === 'url-param') return 'high';
  // label-anchored: 'high' unless the anchor label itself repeats on the page
  // (occurrenceCount > 1 with a repeating label is exactly the shape that
  // can't tell which occurrence is meant — the "Taxes and fees" bug).
  if (extra.ambiguousLabel && pick.occurrenceCount > 1) return 'low';
  return 'high';
}

// ─── Main entry point ────────────────────────────────────────────────────────
export function deriveSpecFromPicks(picks: PickedField[], ctx: PickerCaptureContext): PickerSpecResult {
  const headingsText = (ctx.headings ?? []).join('\n');
  const runtimeCtx = { title: ctx.title, text: ctx.text, url: ctx.url, headingsText };

  const derived: DerivedRule[] = [];
  const problems: DerivationProblem[] = [];

  for (const pick of picks) {
    // An unlocatable pick has no position in the page to anchor against at
    // all — trying to guess a rule from a label/heading/url alone, without
    // ever having confirmed the value actually sits where claimed, is exactly
    // the unverified-guess failure mode this module exists to prevent. Report
    // it and move on rather than emit a rule with nothing behind it.
    if (pick.textIndex === -1) {
      problems.push({ field: pick.field, reason: `pick could not be located in the captured page text (textIndex: -1) — no rule can be verified without a position to anchor against` });
      continue;
    }

    type Candidate = { rule: FieldRule; strategy: DerivationStrategy; ambiguousLabel?: boolean };
    const candidates: Candidate[] = [];
    const urlParam = tryUrlParam(pick, ctx);
    if (urlParam) candidates.push(urlParam);
    const labelAnchored = tryLabelAnchored(pick, ctx);
    if (labelAnchored) candidates.push(labelAnchored);
    const headingPosition = tryHeadingPosition(pick, ctx);
    if (headingPosition) candidates.push(headingPosition);
    const titlePrefix = tryTitlePrefix(pick, ctx);
    if (titlePrefix) candidates.push(titlePrefix);
    const lineOffset = tryLineOffset(pick, ctx);
    if (lineOffset) candidates.push(lineOffset);

    let winner: Candidate | null = null;
    for (const candidate of candidates) {
      if (!verify(candidate.rule, runtimeCtx, pick.value)) continue;
      if (!passesSafetyChecks(pick.field, candidate.rule)) continue;
      winner = candidate;
      break; // candidates are already in priority order — first verified wins
    }

    if (!winner) {
      problems.push({
        field: pick.field,
        reason: `no candidate strategy (url-param, label-anchored, heading-position, title-prefix, line-offset) produced a rule that reproduces the picked value "${pick.value}" against the captured page`,
      });
      continue;
    }

    const transform = inferTransform(pick.value);
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
      confidence: deriveConfidence(winner.strategy, pick, { ambiguousLabel: winner.ambiguousLabel }),
    });
  }

  const spec: ExtractionSpec = {
    version: 1,
    fields: Object.fromEntries(derived.map((d) => [d.field, d.rule])),
    ...(ctx.packageType ? { packageType: ctx.packageType } : {}),
  };

  return { spec, derived, problems };
}

// ─── Merging picked fields into a supplier's stored spec ─────────────────────
//
// deriveSpecFromPicks above only ever sees the fields an agent actually
// clicked — it has no visibility into the rest of the supplier's spec, so its
// output is `{ version, fields: <only what was picked> }` and NOTHING else.
// Storing that wholesale would DELETE, for every field the agent didn't pick:
// the AI's rules for those fields, `constants` (tour_operator and currency
// live there), `wait.textMatches` (the CAPTURE_INCOMPLETE validation check in
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

  const spec: ExtractionSpec = {
    ...base,
    fields: mergedFields,
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
    ? Object.keys(existing).filter((key) => key !== 'version' && key !== 'fields' && (key !== 'packageType' || !picked.packageType))
    : [];

  return { spec, applied, preserved };
}
