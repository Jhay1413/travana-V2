import { describe, expect, it } from 'vitest';
import { deriveSpecFromPicks, mergePickedIntoSpec, type DerivedRule, type PickedField, type PickerCaptureContext } from './picker-spec';
import type { ExtractionSpec, FieldRule } from './extraction.types';
import { runExtractionSpec } from './extraction.interpreter';
import { findUnsafeRules } from './extraction-ai.service';

// Real pages from EXTRACTION_AUDIT.md — a picker that only worked on synthetic
// fixtures would tell us nothing about the accuracy problem in §3.

function pick(overrides: Partial<PickedField> & Pick<PickedField, 'field' | 'value'>): PickedField {
  return {
    textIndex: 0,
    lineIndex: 0,
    linesBefore: [],
    linesAfter: [],
    occurrenceIndex: 0,
    occurrenceCount: 1,
    tag: 'div',
    ancestorTags: ['section'],
    siblingIndex: 0,
    ...overrides,
  };
}

describe('deriveSpecFromPicks — label-anchored', () => {
  it('derives "Trip total" -> £1,447.00 GBP with a number transform (the durable §3 fix shape)', () => {
    const text = [
      'Your cruise summary',
      'Freedom of the Seas',
      '7 nights',
      'Trip total',
      '£1,447.00 GBP',
      'Taxes and fees included',
    ].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://royalcaribbean.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field: 'sales_price',
      value: '£1,447.00 GBP',
      textIndex: text.indexOf('£1,447.00 GBP'),
      lineIndex: 4,
      linesBefore: ['Freedom of the Seas', '7 nights', 'Trip total'],
      linesAfter: ['Taxes and fees included'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.problems).toEqual([]);
    expect(result.derived).toHaveLength(1);
    const derived = result.derived[0];
    expect(derived.strategy).toBe('label-anchored');
    expect(derived.confidence).toBe('high');
    expect(derived.rule.transform).toBe('number');
    expect(derived.rule.regex).toContain('Trip total');

    // The rule must reproduce the exact picked substring when replayed.
    const re = new RegExp(derived.rule.regex!, 'i');
    expect(re.exec(text)?.[1]).toBe('£1,447.00 GBP');
  });

  it('derives "On Board" -> Freedom of the Seas and does NOT match the "Thrilling onboard activities" prose', () => {
    const text = [
      'Thrilling onboard activities await you.',
      'Ship Name',
      'On Board',
      'Freedom of the Seas',
      'Departure Port',
    ].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://royalcaribbean.com/ship/freedom-of-the-seas', title: 'Freedom of the Seas', text };
    const p = pick({
      field: 'ship_name',
      value: 'Freedom of the Seas',
      textIndex: text.indexOf('Freedom of the Seas'),
      lineIndex: 3,
      linesBefore: ['Thrilling onboard activities await you.', 'Ship Name', 'On Board'],
      linesAfter: ['Departure Port'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.derived).toHaveLength(1);
    const derived = result.derived[0];
    expect(derived.strategy).toBe('label-anchored');
    expect(derived.rule.regex).toContain('On Board');

    const re = new RegExp(derived.rule.regex!, 'i');
    expect(re.exec(text)?.[1]).toBe('Freedom of the Seas');
    // The prose line contains "onboard" but is never itself a line reading
    // "On Board" — the anchor must not fire against it in isolation.
    expect(re.test('Thrilling onboard activities await you.')).toBe(false);
  });
});

describe('deriveSpecFromPicks — whitespace-padded captures', () => {
  // The picker's contract trims `pick.value` to the element's clean visible
  // text, but the captured page TEXT the rule is verified against is not
  // guaranteed to be that clean — a trailing space left in the source before
  // the line break, a stray \r from a captured line ending, or an &nbsp;
  // rendered as   all survive into ctx.text untouched. The label-anchored
  // regex's capture group is `([^\n]+)`, which happily swallows that trailing
  // padding — `\s*` after the label only strips LEADING whitespace, nothing
  // strips trailing whitespace off the captured value before verify()
  // compares it byte-for-byte against the trimmed pick.value. If verify()
  // doesn't normalise both sides the same way finalize() (extraction.interpreter.ts)
  // does at real scrape time — which trims unconditionally — a perfectly
  // correct pick is rejected here and never makes it into the stored spec at
  // all, even though the exact same regex would have worked fine at scrape time.
  it('still verifies "Trip total" -> £1,447.00 GBP when the captured line has trailing spaces', () => {
    const text = ['Trip total', '£1,447.00 GBP   ', 'Taxes and fees included'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://royalcaribbean.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field: 'sales_price',
      value: '£1,447.00 GBP', // trimmed ground truth — the bookmarklet never sends trailing spaces
      textIndex: text.indexOf('£1,447.00 GBP'),
      lineIndex: 1,
      linesBefore: ['Trip total'],
      linesAfter: ['Taxes and fees included'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.problems).toEqual([]);
    expect(result.derived).toHaveLength(1);
    expect(result.derived[0].strategy).toBe('label-anchored');
  });

  it('still verifies when the captured line ends with \\r (a captured Windows-style line ending)', () => {
    const text = ['Trip total', '£1,447.00 GBP\r', 'Taxes and fees included'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://royalcaribbean.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field: 'sales_price',
      value: '£1,447.00 GBP',
      textIndex: text.indexOf('£1,447.00 GBP'),
      lineIndex: 1,
      linesBefore: ['Trip total'],
      linesAfter: ['Taxes and fees included'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.problems).toEqual([]);
    expect(result.derived).toHaveLength(1);
  });

  it('still verifies when the captured line has a trailing \\u00a0 (a rendered &nbsp;)', () => {
    const text = ['Trip total', '£1,447.00 GBP ', 'Taxes and fees included'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://royalcaribbean.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field: 'sales_price',
      value: '£1,447.00 GBP',
      textIndex: text.indexOf('£1,447.00 GBP'),
      lineIndex: 1,
      linesBefore: ['Trip total'],
      linesAfter: ['Taxes and fees included'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.problems).toEqual([]);
    expect(result.derived).toHaveLength(1);
  });
});

describe('deriveSpecFromPicks — heading-position', () => {
  it("derives Carnival's second heading -> the voyage name, never the banner's \"IMPORTANT NOTICE\"", () => {
    const headings = ['IMPORTANT NOTICE', '3-Day The Bahamas from Miami, FL'];
    const text = [
      'IMPORTANT NOTICE',
      'Rates subject to change without prior notification of any kind whatsoever.',
      '3-Day The Bahamas from Miami, FL',
      'Departing from Miami, FL',
    ].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://carnival.com/cruise/bahamas', title: 'Carnival Cruise Line', text, headings };
    const p = pick({
      field: 'quote_title',
      value: '3-Day The Bahamas from Miami, FL',
      textIndex: text.indexOf('3-Day The Bahamas from Miami, FL'),
      lineIndex: 2,
      // The immediately preceding line is a full marketing sentence, not a
      // label (>5 words) — label-anchored must not fire here.
      linesBefore: ['IMPORTANT NOTICE', 'Rates subject to change without prior notification of any kind whatsoever.'],
      linesAfter: ['Departing from Miami, FL'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.derived).toHaveLength(1);
    const derived = result.derived[0];
    expect(derived.strategy).toBe('heading-position');
    expect(derived.confidence).toBe('medium');

    const headingsText = headings.join('\n');
    const re = new RegExp(derived.rule.regex!, 'i');
    expect(re.exec(headingsText)?.[1]).toBe('3-Day The Bahamas from Miami, FL');
    expect(re.exec(headingsText)?.[1]).not.toBe('IMPORTANT NOTICE');
  });
});

describe('deriveSpecFromPicks — url-param', () => {
  it("derives currency from Royal Caribbean's selectedCurrencyCode URL param", () => {
    const text = ['Prices shown in GBP', 'Freedom of the Seas', 'From £799pp'].join('\n');
    const ctx: PickerCaptureContext = {
      url: 'https://www.royalcaribbean.com/booking?shipCode=FR&selectedCurrencyCode=GBP&sailDate=2027-05-09',
      title: 'Royal Caribbean',
      text,
    };
    const p = pick({
      field: 'currency',
      value: 'GBP',
      textIndex: text.indexOf('GBP'),
      lineIndex: 0,
      linesBefore: [],
      linesAfter: ['Freedom of the Seas'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.derived).toHaveLength(1);
    const derived = result.derived[0];
    expect(derived.strategy).toBe('url-param');
    expect(derived.confidence).toBe('high');
    expect(derived.rule.from).toBe('url');
    expect(derived.rule.regex).toBe('selectedCurrencyCode=([^&]+)');

    const re = new RegExp(derived.rule.regex!, 'i');
    expect(re.exec(ctx.url)?.[1]).toBe('GBP');
  });
});

describe('deriveSpecFromPicks — ambiguity downgrades confidence', () => {
  it('downgrades to low when the value occurs twice behind a repeating label with no distinguishing anchor', () => {
    const text = [
      'Guest 1',
      'Amount',
      '$50.00',
      'Guest 2',
      'Amount',
      '$50.00',
    ].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://cruisenation.com/quote', title: 'Your Quote', text };
    const p = pick({
      field: 'taxes_and_fees',
      value: '$50.00',
      textIndex: text.indexOf('$50.00'),
      lineIndex: 2,
      linesBefore: ['Guest 1', 'Amount'],
      linesAfter: ['Guest 2'],
      occurrenceIndex: 0,
      occurrenceCount: 2, // the value repeats — once per guest
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.derived).toHaveLength(1);
    const derived = result.derived[0];
    expect(derived.strategy).toBe('label-anchored');
    expect(derived.confidence).toBe('low'); // "Amount" repeats, so the anchor can't tell guest 1 from guest 2
  });
});

describe('deriveSpecFromPicks — money transform inference', () => {
  // A picked money value very often carries its label with it ("Total Price
  // £2124.06", not a bare "£2124.06") because the picker captures the whole
  // element's visible text, not just the digits. inferTransform must find the
  // currency amount anywhere in the value, not only when it's the very first
  // character — otherwise the rule gets no 'number' transform, the raw label
  // string reaches nbr() (extraction.interpreter.ts) as Number(str) || 0, and
  // the price silently becomes 0 (which checkMoney then quarantines away).
  it.each([
    'Total Price £2124.06',
    '£2,124.06',
    'from £999',
    'Price: $1,200.00',
  ])('derives a number transform for %j', (value) => {
    const text = ['Trip total', value, 'Taxes and fees included'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://example.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field: 'sales_price',
      value,
      textIndex: text.indexOf(value),
      lineIndex: 1,
      linesBefore: ['Trip total'],
      linesAfter: ['Taxes and fees included'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.problems).toEqual([]);
    expect(result.derived).toHaveLength(1);
    expect(result.derived[0].rule.transform).toBe('number');
  });

  // Values that merely contain digits, but are not a money amount, must NOT
  // be inferred as numbers — inferTransform's INTEGER_RE branch already
  // handles bare counts ("7" nights, "2" adults) deliberately; these are the
  // shapes that must stay untouched strings instead of getting mangled by a
  // wrongly-inferred 'number' transform.
  it.each([
    ['2 adults', 'occupancy'],
    ['Room 2', 'room_number'],
    ['7 nights', 'nights'],
    ['Flight BA2490', 'flight_number'],
    ['Deck 12, Cabin 4021', 'cabin'],
  ])('does NOT infer a number transform for %j (field: %s)', (value, field) => {
    const text = ['Trip details', value, 'More info'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://example.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field,
      value,
      textIndex: text.indexOf(value),
      lineIndex: 1,
      linesBefore: ['Trip details'],
      linesAfter: ['More info'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.problems).toEqual([]);
    expect(result.derived).toHaveLength(1);
    expect(result.derived[0].rule.transform).toBeUndefined();
  });
});

describe('deriveSpecFromPicks — unlocatable picks', () => {
  it('records a DerivationProblem and emits no rule when textIndex is -1', () => {
    const text = ['Some page text', 'that does not contain the picked value'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://example.com/deal', title: 'Deal', text };
    const p = pick({
      field: 'mystery_field',
      value: 'Never actually on the page',
      textIndex: -1,
      lineIndex: -1,
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.derived).toEqual([]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].field).toBe('mystery_field');
    expect(result.problems[0].reason).toMatch(/textIndex: -1/);
  });
});

describe('deriveSpecFromPicks — verification rejects unverifiable picks', () => {
  it('records a problem instead of a rule when no strategy reproduces the picked value', () => {
    const text = ['A page with completely unrelated content', 'nothing here matches'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://example.com/deal', title: 'Deal', text };
    const p = pick({
      field: 'ghost_field',
      value: 'Value that is not really in the text',
      textIndex: 5, // claims to be locatable, but nothing here actually verifies
      lineIndex: 0,
      linesBefore: ['A page with completely unrelated content'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.derived).toEqual([]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].field).toBe('ghost_field');
  });
});

describe('deriveSpecFromPicks — spec assembly', () => {
  it('builds an ExtractionSpec whose fields match the derived rules', () => {
    const text = ['Trip total', '£1,447.00 GBP'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://royalcaribbean.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field: 'sales_price',
      value: '£1,447.00 GBP',
      textIndex: text.indexOf('£1,447.00 GBP'),
      linesBefore: ['Trip total'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.spec.version).toBe(1);
    expect(result.spec.fields.sales_price).toEqual(result.derived[0].rule);
  });

  // The picker now asks which package type a supplier's pages are BEFORE
  // showing fields (capture-bookmarklet.js). That answer rides on the
  // context and must land on the derived spec unchanged, so the interpreter
  // treats it as authoritative exactly as it does for an AI-generated spec —
  // this is what stops a picker-derived cruise spec from being demoted to a
  // package holiday if the agent never clicks a ship_name field at all.
  it('carries the declared packageType from the context onto the derived spec', () => {
    const text = ['Trip total', '£1,447.00 GBP'].join('\n');
    const ctx: PickerCaptureContext = {
      url: 'https://royalcaribbean.com/booking/confirm',
      title: 'Booking Confirmation',
      text,
      packageType: 'cruise',
    };
    const p = pick({
      field: 'sales_price',
      value: '£1,447.00 GBP',
      textIndex: text.indexOf('£1,447.00 GBP'),
      linesBefore: ['Trip total'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.spec.packageType).toBe('cruise');
  });

  it('omits packageType from the derived spec when the context does not declare one', () => {
    const text = ['Trip total', '£1,447.00 GBP'].join('\n');
    const ctx: PickerCaptureContext = { url: 'https://royalcaribbean.com/booking/confirm', title: 'Booking Confirmation', text };
    const p = pick({
      field: 'sales_price',
      value: '£1,447.00 GBP',
      textIndex: text.indexOf('£1,447.00 GBP'),
      linesBefore: ['Trip total'],
    });

    const result = deriveSpecFromPicks([p], ctx);

    expect(result.spec.packageType).toBeUndefined();
  });
});

// ─── mergePickedIntoSpec ──────────────────────────────────────────────────────
//
// deriveSpecFromPicks only ever knows the fields an agent clicked, so its
// output must never be stored wholesale — see picker-spec.ts's commentary on
// mergePickedIntoSpec for the concrete list of what that would delete
// (constants, wait.textMatches, itineraryRegex, luggageRegex, image config,
// every other field's rule).

function derivedRule(field: string, value: string, strategy = 'label-anchored', confidence: DerivedRule['confidence'] = 'high'): DerivedRule {
  return {
    field,
    strategy,
    confidence,
    rule: {
      from: 'text',
      regex: `${field}: ([^\\n]+)`,
      group: 1,
      origin: 'picked',
      verifiedValue: value,
      strategy,
      pickedAt: '2026-09-06T12:00:00.000Z',
    },
  };
}

// A 20-field spec representative of a real stored supplier config: an
// AI-generated field per common/cruise attribute, plus every spec-level key a
// merge must not lose.
function twentyFieldSpec(): ExtractionSpec {
  const fields: Record<string, FieldRule> = {};
  for (let i = 1; i <= 20; i++) {
    fields[`field_${i}`] = { from: 'text', regex: `field_${i}: ([^\\n]+)`, group: 1 };
  }
  return {
    version: 1,
    fields,
    constants: { tour_operator: 'Acme Cruises', currency: 'USD' },
    wait: { textMatches: '\\$\\d+', timeoutMs: 30000 },
    itineraryRegex: 'Day\\s*(\\d+)[:\\s]+([^\\n]+)',
    luggageRegex: '\\((\\d+)\\)\\s*(\\d+kg)',
    imageUrlIncludes: 'cdn.example.com/gallery',
  };
}

describe('mergePickedIntoSpec — merges, never replaces', () => {
  it('picking 2 of 20 fields leaves the other 18 untouched and keeps constants/wait/itineraryRegex', () => {
    const existing = twentyFieldSpec();
    const derived = [derivedRule('field_1', 'picked value one'), derivedRule('field_2', 'picked value two')];
    const picked: ExtractionSpec = { version: 1, fields: { field_1: derived[0].rule, field_2: derived[1].rule } };

    const result = mergePickedIntoSpec(existing, picked, derived);

    expect(Object.keys(result.spec.fields)).toHaveLength(20);
    expect(result.spec.fields.field_1).toEqual(derived[0].rule);
    expect(result.spec.fields.field_2).toEqual(derived[1].rule);
    // Every OTHER field rule is the exact original object, untouched.
    for (let i = 3; i <= 20; i++) {
      expect(result.spec.fields[`field_${i}`]).toEqual(existing.fields[`field_${i}`]);
    }
    expect(result.spec.constants).toEqual(existing.constants);
    expect(result.spec.wait).toEqual(existing.wait);
    expect(result.spec.itineraryRegex).toBe(existing.itineraryRegex);
    expect(result.spec.luggageRegex).toBe(existing.luggageRegex);
    expect(result.spec.imageUrlIncludes).toBe(existing.imageUrlIncludes);

    expect(result.preserved).toEqual(
      expect.arrayContaining(['constants', 'wait', 'itineraryRegex', 'luggageRegex', 'imageUrlIncludes']),
    );
    expect(result.applied).toHaveLength(2);
  });

  it('reports replaced: "picked" when overwriting a field a human previously picked', () => {
    const existing: ExtractionSpec = {
      version: 1,
      fields: {
        sales_price: {
          from: 'text',
          regex: 'Trip total\\s*\\n+\\s*([^\\n]+)',
          origin: 'picked',
          verifiedValue: '£1,447.00',
          strategy: 'label-anchored',
          pickedAt: '2026-08-01T00:00:00.000Z',
        },
      },
    };
    const derived = [derivedRule('sales_price', '£1,500.00')];
    const picked: ExtractionSpec = { version: 1, fields: { sales_price: derived[0].rule } };

    const result = mergePickedIntoSpec(existing, picked, derived);

    expect(result.applied[0]).toMatchObject({ field: 'sales_price', replaced: 'picked', verifiedValue: '£1,500.00' });
    expect(result.spec.fields.sales_price).toEqual(derived[0].rule);
  });

  it('reports replaced: "generated" when overwriting an AI-generated rule (no origin, or origin: "generated")', () => {
    const existing: ExtractionSpec = {
      version: 1,
      fields: { sales_price: { from: 'text', regex: '\\$([\\d,]+)', transform: 'number' } }, // no `origin` — predates provenance
    };
    const derived = [derivedRule('sales_price', '£1,500.00')];
    const picked: ExtractionSpec = { version: 1, fields: { sales_price: derived[0].rule } };

    const result = mergePickedIntoSpec(existing, picked, derived);

    expect(result.applied[0].replaced).toBe('generated');
  });

  it('reports replaced: null for a field that did not exist before', () => {
    const existing: ExtractionSpec = { version: 1, fields: {} };
    const derived = [derivedRule('brand_new_field', 'some value')];
    const picked: ExtractionSpec = { version: 1, fields: { brand_new_field: derived[0].rule } };

    const result = mergePickedIntoSpec(existing, picked, derived);

    expect(result.applied[0].replaced).toBeNull();
  });

  it('merging into no existing spec works — everything comes from the picks, nothing to preserve', () => {
    const derived = [derivedRule('sales_price', '£1,500.00')];
    const picked: ExtractionSpec = { version: 1, fields: { sales_price: derived[0].rule } };

    const result = mergePickedIntoSpec(undefined, picked, derived);

    expect(result.spec.fields).toEqual({ sales_price: derived[0].rule });
    expect(result.preserved).toEqual([]);
    expect(result.applied).toEqual([
      { field: 'sales_price', strategy: 'label-anchored', confidence: 'high', verifiedValue: '£1,500.00', replaced: null },
    ]);
  });

  it("a declared packageType from the pick wins over the existing spec's, and is excluded from `preserved`", () => {
    const existing: ExtractionSpec = { version: 1, fields: {}, packageType: 'package-holiday' };
    const derived = [derivedRule('ship_name', 'Freedom of the Seas')];
    const picked: ExtractionSpec = { version: 1, fields: { ship_name: derived[0].rule }, packageType: 'cruise' };

    const result = mergePickedIntoSpec(existing, picked, derived);

    expect(result.spec.packageType).toBe('cruise');
    expect(result.preserved).not.toContain('packageType');
  });

  it('keeps the existing packageType when the pick does not declare one', () => {
    const existing: ExtractionSpec = { version: 1, fields: {}, packageType: 'cruise' };
    const derived = [derivedRule('sales_price', '£1,500.00')];
    const picked: ExtractionSpec = { version: 1, fields: { sales_price: derived[0].rule } };

    const result = mergePickedIntoSpec(existing, picked, derived);

    expect(result.spec.packageType).toBe('cruise');
    expect(result.preserved).toContain('packageType');
  });
});

describe('bookmarklet field groups match the server field lists', () => {
  // The ONLY entries allowed in a bookmarklet group but absent from the server
  // lists: page-region pickers (deriveFlightsSection / itinerary handling), not
  // value fields. Any other extra, or any missing server field, is drift.
  const BOOKMARKLET_ONLY = ['flights_section', 'flights_outbound_section', 'flights_return_section', 'itinerary_section'];

  const quoted = (body: string): string[] => (body.match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1));

  async function load() {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const server = await import('./extraction-ai.service');
    const src = readFileSync(resolve(process.cwd(), 'public/capture-bookmarklet.js'), 'utf8');
    return { src, server };
  }

  function groupFields(src: string, re: RegExp): string[] {
    const m = src.match(re);
    expect(m, 'group not found in bookmarklet').not.toBeNull();
    return quoted(m![1]);
  }

  function expectNoDrift(bookmarklet: string[], server: readonly string[]) {
    expect(new Set(bookmarklet).size).toBe(bookmarklet.length);
    const unexpectedExtras = bookmarklet.filter((f) => !server.includes(f) && !BOOKMARKLET_ONLY.includes(f));
    expect(unexpectedExtras, 'bookmarklet fields unknown to the server').toEqual([]);
    const valueFields = bookmarklet.filter((f) => !BOOKMARKLET_ONLY.includes(f));
    expect([...valueFields].sort()).toEqual([...server].sort());
  }

  it('common group matches COMMON_FIELDS', async () => {
    const { src, server } = await load();
    const fields = groupFields(src, /COMMON_FIELD_GROUP\s*=\s*\{[^}]*?fields:\s*\[([^\]]*)\]/);
    expect(fields).toEqual(expect.arrayContaining(['country', 'destination', 'resort']));
    expectNoDrift(fields, server.COMMON_FIELDS);
  });

  it('package-holiday group matches PACKAGE_HOLIDAY_FIELDS', async () => {
    const { src, server } = await load();
    expectNoDrift(groupFields(src, /'package-holiday':\s*\{[^}]*?fields:\s*\[([^\]]*)\]/), server.PACKAGE_HOLIDAY_FIELDS);
  });

  it('cruise group matches CRUISE_FIELDS', async () => {
    const { src, server } = await load();
    expectNoDrift(groupFields(src, /cruise:\s*\{[^}]*?fields:\s*\[([^\]]*)\]/), server.CRUISE_FIELDS);
  });

  it('lodge group matches LODGE_FIELDS exactly (no drift)', async () => {
    const { src, server } = await load();
    const fields = groupFields(src, /lodge:\s*\{[^}]*?fields:\s*\[([^\]]*)\]/);
    expect(fields).toEqual([...server.LODGE_FIELDS]);
    expect(fields).toEqual(expect.arrayContaining(['lodge_code', 'lodge_park_code', 'accommodation']));
  });
});

// Real Hoseasons lodge capture (EXTRACTION failure: lodge_code "Ref: LP31765" and
// lodge_park_name "White Cross Bay" both produced no rule). The text keeps the
// quoted consecutive lines, "White Cross Bay" many times but never as its own
// line, and several bare "(LP31763)"-style codes so uniqueness is really tested.
describe('deriveSpecFromPicks — Hoseasons lodge (rule-derivation strategies)', () => {
  const text = [
    'Home > Lodges > Cumbria > White Cross Bay > Gold 3 Caravan with parking',
    'Gold 3 Caravan with parking',
    'White Cross Bay in Lake Windermere , Cumbria',
    '',
    'Ref: LP31765',
    '',
    'Other locations within 30 miles of White Cross Bay',
    'Silver 2 Caravan',
    '(LP31763)',
    'Gold 2 Caravan',
    '(LP31764)',
    'Booking steps at White Cross Bay',
  ].join('\n');
  const ctx: PickerCaptureContext = {
    url: 'https://www.hoseasons.co.uk/agents/lodges/white-cross-bay-pwba/gold-3-caravan-with-parking-lp31765?start=03-10-2026&adult=2&nights=7&range=3',
    title: 'Gold 3 Caravan with parking - White Cross Bay - Lodges - Book Online - Hoseasons',
    text,
  };
  const lodgeCode = pick({
    field: 'lodge_code',
    value: 'Ref: LP31765',
    textIndex: text.indexOf('Ref: LP31765'),
    lineIndex: 4,
    linesBefore: ['Home > Lodges > Cumbria > White Cross Bay > Gold 3 Caravan with parking', 'Gold 3 Caravan with parking', 'White Cross Bay in Lake Windermere , Cumbria'],
  });
  const parkName = pick({
    field: 'lodge_park_name',
    value: 'White Cross Bay',
    textIndex: text.indexOf('White Cross Bay'),
    occurrenceCount: 4,
  });

  function replay(rule: FieldRule, from: 'text' | 'title' | 'url'): string | undefined {
    const source = from === 'title' ? ctx.title : from === 'url' ? ctx.url : text;
    return new RegExp(rule.regex!, 'i').exec(source)?.[rule.group ?? 1];
  }

  it('lodge_code "Ref: LP31765" yields a verified value-pattern-line rule (whole line, generalised digits)', () => {
    const result = deriveSpecFromPicks([lodgeCode], ctx);

    expect(result.problems).toEqual([]);
    const d = result.derived[0];
    expect(d.strategy).toBe('value-pattern-line');
    expect(d.confidence).toBe('medium');
    expect(d.rule.regex).toContain('Ref:');
    expect(d.rule.regex).toContain('\\d+');
    expect(d.rule.regex).not.toContain('31765'); // generalised, not hardcoded
    expect(replay(d.rule, 'text')).toBe('Ref: LP31765');
    expect(d.rule.verifiedValue).toBe('Ref: LP31765');
  });

  it('the value-pattern-line rule generalises to another lodge page and ignores bare (LP…) codes', () => {
    const d = deriveSpecFromPicks([lodgeCode], ctx).derived[0];
    const otherPage = ['Silver 2 Caravan', 'Somewhere else', '', 'Ref: LP99012', '', '(LP31763)'].join('\n');
    expect(new RegExp(d.rule.regex!, 'i').exec(otherPage)?.[1]).toBe('Ref: LP99012');
    expect(new RegExp(d.rule.regex!, 'i').exec('(LP31763)\n(LP31764)')).toBeNull();
  });

  it('lodge_park_name "White Cross Bay" yields a verified url-path-slug rule (trailing -pwba stripped), high confidence', () => {
    const result = deriveSpecFromPicks([parkName], ctx);

    expect(result.problems).toEqual([]);
    const d = result.derived[0];
    expect(d.strategy).toBe('url-path-slug');
    expect(d.confidence).toBe('high');
    expect(d.rule.from).toBe('url');
    expect(d.rule.transform).toBe('titleCase');
    // raw capture is the slug minus the code; the titleCase transform finishes the job
    expect(replay(d.rule, 'url')).toBe('white-cross-bay');
    expect(d.rule.regex).not.toContain('white-cross-bay'); // not hardcoded
  });

  it('url-path-slug does not over-strip: a shorter value cannot match the slug', () => {
    for (const value of ['White Cross', 'Gold 3 Caravan']) {
      const r = deriveSpecFromPicks([pick({ field: 'x', value, textIndex: 0 })], ctx);
      expect(r.derived).toEqual([]);
    }
  });

  it('title-segment derives a non-prefix title segment when the URL cannot supply it', () => {
    const noSlug: PickerCaptureContext = { ...ctx, url: 'https://www.hoseasons.co.uk/lodge?id=1' };
    const result = deriveSpecFromPicks([pick({ field: 'lodge_park_name', value: 'White Cross Bay', textIndex: 0 })], noSlug);

    expect(result.problems).toEqual([]);
    const d = result.derived[0];
    expect(d.strategy).toBe('title-segment');
    expect(d.confidence).toBe('medium');
    expect(replay(d.rule, 'title')).toBe('White Cross Bay');
  });

  it('title-segment handles a title that mixes separators (each separator is tried on its own split)', () => {
    const mixed: PickerCaptureContext = { url: 'https://x.test/', title: 'Deal | Lodge - Park Name | Operator', text: 'Park Name\nother' };
    const result = deriveSpecFromPicks([pick({ field: 'park', value: 'Operator', textIndex: 0 })], mixed);
    expect(result.derived[0].strategy).toBe('title-segment');
    expect(new RegExp(result.derived[0].rule.regex!, 'i').exec(mixed.title)?.[1]).toBe('Operator');
  });

  it('a value with no derivable source still reports the no-candidate reason', () => {
    const result = deriveSpecFromPicks([pick({ field: 'x', value: 'Lake Windermere Retreat', textIndex: 0 })], ctx);
    expect(result.derived).toEqual([]);
    expect(result.problems[0].reason).toContain('no candidate strategy');
  });

  it('value-pattern-line refuses a pattern that is not unique on the page ("(LP31763)" codes)', () => {
    const result = deriveSpecFromPicks([pick({ field: 'code', value: '(LP31763)', textIndex: text.indexOf('(LP31763)') })], ctx);
    expect(result.derived).toEqual([]);
    expect(result.problems[0].reason).toContain('no candidate strategy');
  });
});

describe('deriveSpecFromPicks — unstable anchors and promo-line tolerance', () => {
  const ctxFor = (text: string): PickerCaptureContext => ({ url: 'https://example-travel.com/deal/1', title: 'Deal', text });

  it('(a) a rule picked on a page without a "Was" line still extracts from a later page with one inserted', () => {
    const text = ['Hotel Sol', '7 nights', 'Price per person', '£899', 'Book now'].join('\n');
    const result = deriveSpecFromPicks(
      [pick({ field: 'sales_price', value: '£899', textIndex: text.indexOf('£899'), linesBefore: ['Hotel Sol', '7 nights', 'Price per person'] })],
      ctxFor(text),
    );
    expect(result.problems).toEqual([]);
    const rule = result.derived[0].rule;
    expect(rule.regex).toContain('Price per person');
    const re = new RegExp(rule.regex!, 'i');
    const later = ['Hotel Sol', '7 nights', 'Price per person', 'Was £2,499', 'Save £300', '£2,199', 'Book now'].join('\n');
    expect(re.exec(later)?.[1]).toBe('£2,199');
    expect(re.exec(text)?.[1]).toBe('£899');
  });

  it('(b) a "Was £2,199" line directly above the value is not used as the label', () => {
    const text = ['Hotel Sol', 'Price per person', 'Was £2,199', '£1,899', 'Book now'].join('\n');
    const result = deriveSpecFromPicks(
      [pick({ field: 'sales_price', value: '£1,899', textIndex: text.indexOf('£1,899'), linesBefore: ['Hotel Sol', 'Price per person', 'Was £2,199'] })],
      ctxFor(text),
    );
    expect(result.problems).toEqual([]);
    expect(result.derived[0].rule.regex).toContain('Price per person');
    expect(result.derived[0].rule.regex).not.toContain('2,199');
  });

  it('(c) a date line above a value is not used as the label', () => {
    const text = ['Hotel Sol', 'Departure', 'Sat 12 Oct 2026', 'Manchester', 'Done'].join('\n');
    const result = deriveSpecFromPicks(
      [pick({ field: 'departure_airport', value: 'Manchester', textIndex: text.indexOf('Manchester'), linesBefore: ['Hotel Sol', 'Departure', 'Sat 12 Oct 2026'] })],
      ctxFor(text),
    );
    // The earlier "Departure" label can't reach the value across the date line, so no rule is the safe outcome.
    for (const d of result.derived) expect(d.rule.regex).not.toContain('Oct');
  });

  it('rejects other unstable lines but keeps short labels with small numbers', () => {
    for (const bad of ['12:30', '25% off', 'Offer ends in 2 days']) {
      const text = ['Adults (18+)', bad, 'Value X', 'end'].join('\n');
      const r = deriveSpecFromPicks(
        [pick({ field: 'f', value: 'Value X', textIndex: text.indexOf('Value X'), linesBefore: ['Adults (18+)', bad] })],
        ctxFor(text),
      );
      for (const d of r.derived) expect(d.rule.regex).not.toContain(bad.startsWith('12') ? '12:30' : bad.startsWith('25') ? '25%' : 'ends in');
    }
    const text = ['Adults (18+)', 'Value X', 'end'].join('\n');
    const r = deriveSpecFromPicks(
      [pick({ field: 'f', value: 'Value X', textIndex: text.indexOf('Value X'), linesBefore: ['Adults (18+)'] })],
      ctxFor(text),
    );
    expect(r.derived[0].rule.regex).toContain('Adults');
  });

  it('does not skip a value that itself starts with a promo word', () => {
    const text = ['Leaving', 'Leaving from', 'From Manchester', 'end'].join('\n');
    const result = deriveSpecFromPicks(
      [pick({ field: 'departure_airport', value: 'From Manchester', textIndex: text.indexOf('From Manchester'), linesBefore: ['Leaving', 'Leaving from'] })],
      ctxFor(text),
    );
    expect(result.derived).toHaveLength(1);
    expect(new RegExp(result.derived[0].rule.regex!, 'i').exec(text)?.[1]).toBe('From Manchester');
  });
});

// ─── TUI retail agents portal: inline-label + label-after ────────────────────
describe('deriveSpecFromPicks — TUI inline price label', () => {
  const TUI_TEXT = [
    'Riu Montego Bay',
    '',
    'IN MONTEGO BAY, JAMAICA',
    '',
    'Green & Fair Hotel',
    'Plus',
    '£1976.24pp',
    'Total Price £3952.48',
    'Continue',
    'Incl. mandatory fees & taxes',
    '1/26',
  ].join('\n');
  const TUI_URL = 'https://agents.tui.co.uk/holiday/summary';
  const TUI_TITLE = 'TUI Holidays | Live Happy | tui.co.uk';
  const TUI_HEADINGS = ['Riu Montego Bay', 'About the hotel', 'Your room', 'Your board', 'Location', 'Hotel details', 'Green & Fair', 'We value your privacy'];
  const ctx: PickerCaptureContext = { url: TUI_URL, title: TUI_TITLE, text: TUI_TEXT, headings: TUI_HEADINGS };

  const salesPick = pick({
    field: 'sales_price',
    value: 'Total Price £3952.48',
    textIndex: TUI_TEXT.indexOf('Total Price £3952.48'),
    lineIndex: 7,
    linesBefore: ['Green & Fair Hotel', 'Plus', '£1976.24pp'],
    linesAfter: ['Continue', 'Incl. mandatory fees & taxes'],
  });
  const perPersonPick = pick({
    field: 'price_per_person',
    value: '£1976.24pp',
    textIndex: TUI_TEXT.indexOf('£1976.24pp'),
    lineIndex: 6,
    linesBefore: ['IN MONTEGO BAY, JAMAICA', 'Green & Fair Hotel', 'Plus'],
    linesAfter: ['Total Price £3952.48', 'Continue'],
  });

  const run = (spec: ExtractionSpec, text: string) =>
    runExtractionSpec(spec, { title: TUI_TITLE, text, url: TUI_URL }, '2026-01-01T00:00:00Z');

  const result = deriveSpecFromPicks([salesPick, perPersonPick], ctx);
  const byField = (f: string): DerivedRule | undefined => result.derived.find((d) => d.field === f);

  it('derives sales_price as inline-label and the interpreter reads 3952.48', () => {
    expect(result.problems).toEqual([]);
    const d = byField('sales_price');
    expect(d?.strategy).toBe('inline-label');
    expect(d?.confidence).toBe('high');
    expect(d?.rule.transform).toBe('number');
    expect(run(result.spec, TUI_TEXT).sales_price).toBe(3952.48);
  });

  it('derives price_per_person as label-after anchored on "Total Price" and reads 1976.24', () => {
    const d = byField('price_per_person');
    expect(d?.strategy).toBe('label-after');
    expect(d?.rule.regex).toContain('Total[ \\t]+Price');
    expect(d?.rule.regex).not.toContain('Plus');
    expect(run(result.spec, TUI_TEXT).price_per_person).toBe(1976.24);
  });

  it('replays both rules on a different hotel with no badge lines', () => {
    const page2 = ['Hotel Example', '', 'IN PAPHOS, CYPRUS', '', '£899.50pp', 'Total Price £1799.00', 'Continue'].join('\n');
    const q = run(result.spec, page2);
    expect(q.sales_price).toBe(1799);
    expect(q.price_per_person).toBe(899.5);
  });

  it('inline-label is unaffected by a promo line inserted before the total', () => {
    const page3 = ['Hotel Example', '£899.50pp', 'Was £2,100', 'Total Price £1799.00', 'Continue'].join('\n');
    expect(run(result.spec, page3).sales_price).toBe(1799);
  });

  it('never uses the per-person price line as a label for sales_price', () => {
    const d = byField('sales_price');
    expect(d?.rule.regex).not.toContain('1976');
    expect(d?.rule.regex).not.toContain('pp');
  });

  it('tries every acceptable preceding line, not just the nearest', () => {
    const text = ['Trip total', 'Badge', '£500.00'].join('\n');
    // nearest "Badge" verifies here, but a farther label must also be offered
    const p = pick({ field: 'sales_price', value: '£500.00', textIndex: 12, linesBefore: ['Trip total', 'Badge'] });
    const r = deriveSpecFromPicks([p], { url: 'https://x.test/', title: '', text });
    expect(r.problems).toEqual([]);
    expect(r.derived[0].strategy).toBe('label-anchored');
  });
});

describe('deriveSpecFromPicks — children / infants counts (like adults)', () => {
  const ctxFor = (text: string): PickerCaptureContext => ({ url: 'https://example.com/booking', title: 'Booking', text });

  it('derives a bare "1" under a "Children" label and replays to 1', () => {
    const text = ['Your party', 'Adults', '2', 'Children', '1', 'Infants (0-1)', '0'].join('\n');
    const p = pick({ field: 'children', value: '1', textIndex: text.indexOf('Children\n1') + 9, lineIndex: 4, linesBefore: ['Adults', '2', 'Children'], linesAfter: ['Infants (0-1)', '0'] });
    const result = deriveSpecFromPicks([p], ctxFor(text));
    expect(result.problems).toEqual([]);
    expect(result.derived[0].strategy).toBe('label-anchored');
    expect(result.derived[0].rule.regex).toContain('Children');
    expect(result.derived[0].rule.transform).toBe('number');
    expect(runExtractionSpec(result.spec, { title: 'Booking', text, url: 'https://example.com/booking' }, 'x').children).toBe(1);
  });

  it('derives a bare "1" under an "Infants (0-1)" label', () => {
    const text = ['Your party', 'Adults', '2', 'Children', '0', 'Infants (0-1)', '1'].join('\n');
    const p = pick({ field: 'infants', value: '1', textIndex: text.lastIndexOf('1'), lineIndex: 6, linesBefore: ['Children', '0', 'Infants (0-1)'], linesAfter: [] });
    const result = deriveSpecFromPicks([p], ctxFor(text));
    expect(result.problems).toEqual([]);
    expect(result.derived[0].rule.regex).toContain('Infants');
    expect(runExtractionSpec(result.spec, { title: 'Booking', text, url: 'https://example.com/booking' }, 'x').infants).toBe(1);
  });

  it.each([
    ['children', '1 Child', '2 Adults', 1],
    ['children', '2 Children', '2 Adults', 2],
    ['infants', '1 Infant', '2 Adults', 1],
  ])('derives inline "%s" pick %j and yields the number', (field, value, adultsLine, expected) => {
    const text = ['Trip details', adultsLine, value, 'More info'].join('\n');
    const p = pick({ field, value, textIndex: text.indexOf(value), lineIndex: 2, linesBefore: ['Trip details', adultsLine], linesAfter: ['More info'] });
    const result = deriveSpecFromPicks([p], ctxFor(text));
    expect(result.problems).toEqual([]);
    expect(result.derived[0].rule.transform).toBe('number');
    const q = runExtractionSpec(result.spec, { title: 'Booking', text, url: 'https://example.com/booking' }, 'x') as unknown as Record<string, number>;
    expect(q[field]).toBe(expected);
  });
});

describe('deriveSpecFromPicks — party-count (adults/children/infants on ONE element)', () => {
  const URL_ = 'https://example.com/booking';
  const ctxFor = (text: string): PickerCaptureContext => ({ url: URL_, title: 'Booking', text });
  const party = (field: string, value: string, text: string) =>
    pick({ field, value, textIndex: text.indexOf(value), lineIndex: 1, linesBefore: ['Trip details'], linesAfter: ['More info'] });
  const page = (line: string) => ['Trip details', line, 'More info'].join('\n');
  const replay = (spec: ExtractionSpec, text: string): Record<string, number> =>
    runExtractionSpec(spec, { title: 'Booking', text, url: URL_ }, 'x') as unknown as Record<string, number>;
  const LINE = 'Travelers: 2 adults and 1 child';

  it('captures only the picked field\'s number', () => {
    const text = page(LINE);
    const c = deriveSpecFromPicks([party('children', LINE, text)], ctxFor(text));
    expect(c.problems).toEqual([]);
    const rule = c.derived.find((d) => d.field === 'children')!;
    expect(rule.strategy).toBe('party-count');
    expect(rule.rule.transform).toBe('number');
    expect(rule.rule.regex).toContain('Travelers');
    expect(replay(c.spec, text).children).toBe(1);

    const a = deriveSpecFromPicks([party('adults', LINE, text)], ctxFor(text));
    expect(replay(a.spec, text).adults).toBe(2);
  });

  it('one pick (adults) also yields children and infants rules', () => {
    const text = page(LINE);
    const r = deriveSpecFromPicks([party('adults', LINE, text)], ctxFor(text));
    expect(r.derived.map((d) => d.field).sort()).toEqual(['adults', 'children', 'infants']);
    expect(r.derived.every((d) => d.strategy === 'party-count' && d.rule.origin === 'picked')).toBe(true);
    expect(r.derived.find((d) => d.field === 'children')!.rule.verifiedValue).toBe('1');
    expect(r.derived.find((d) => d.field === 'infants')!.rule.verifiedValue).toBe('0');
    expect(findUnsafeRules(r.spec)).toEqual([]);
    expect(replay(r.spec, text)).toMatchObject({ adults: 2, children: 1, infants: 0 });
    const merged = mergePickedIntoSpec(undefined, r.spec, r.derived);
    expect(merged.applied.map((x) => x.field).sort()).toEqual(['adults', 'children', 'infants']);
  });

  it('does not create a sibling for a field picked separately in the batch', () => {
    const text = ['Trip details', LINE, 'Infants', '1', 'More info'].join('\n');
    const infants = pick({ field: 'infants', value: '1', textIndex: text.lastIndexOf('1'), lineIndex: 3, linesBefore: [LINE, 'Infants'], linesAfter: ['More info'] });
    const r = deriveSpecFromPicks([party('adults', LINE, text), infants], ctxFor(text));
    expect(r.derived.filter((d) => d.field === 'infants')).toHaveLength(1);
    expect(r.derived.find((d) => d.field === 'infants')!.strategy).not.toBe('party-count');
  });

  it('replays on later pages', () => {
    const text = page(LINE);
    const { spec } = deriveSpecFromPicks([party('adults', LINE, text)], ctxFor(text));
    expect(replay(spec, page('Travelers: 2 adults'))).toMatchObject({ adults: 2, children: 0, infants: 0 });
    expect(replay(spec, page('Travelers: 2 adults, 2 children and 1 infant'))).toMatchObject({ adults: 2, children: 2, infants: 1 });
    expect(replay(spec, page('Travelers: 1 adult and 1 child'))).toMatchObject({ adults: 1, children: 1, infants: 0 });
  });

  it('handles the word-before format', () => {
    const line = 'Adults: 2 Children: 1';
    const text = page(line);
    const r = deriveSpecFromPicks([party('children', line, text)], ctxFor(text));
    expect(r.problems).toEqual([]);
    expect(r.derived.find((d) => d.field === 'children')!.strategy).toBe('party-count');
    expect(replay(r.spec, text)).toMatchObject({ adults: 2, children: 1, infants: 0 });
    expect(findUnsafeRules(r.spec)).toEqual([]);
  });

  it.each([
    ['2 Adults, 1 Child', 2, 1],
    ['Guests 2 adults · 1 kid', 2, 1],
  ])('handles %j', (line, adults, children) => {
    const text = page(line);
    const r = deriveSpecFromPicks([party('adults', line, text)], ctxFor(text));
    expect(r.problems).toEqual([]);
    expect(replay(r.spec, text)).toMatchObject({ adults, children, infants: 0 });
    expect(findUnsafeRules(r.spec)).toEqual([]);
  });

  it('keeps the existing strategy for a single-token value', () => {
    const text = ['Trip details', '2 Adults', '1 Child', 'More info'].join('\n');
    const r = deriveSpecFromPicks([pick({ field: 'children', value: '1 Child', textIndex: text.indexOf('1 Child'), lineIndex: 2, linesBefore: ['Trip details', '2 Adults'], linesAfter: ['More info'] })], ctxFor(text));
    expect(r.derived).toHaveLength(1);
    expect(r.derived[0].strategy).not.toBe('party-count');
    expect(replay(r.spec, text).children).toBe(1);
  });

  it('a picked children/infants rule that does not match resolves to 0 (not another field\'s number)', () => {
    const text = page(LINE);
    const { spec } = deriveSpecFromPicks([party('adults', LINE, text)], ctxFor(text));
    const q = replay(spec, page('Travelers: 3 adults'));
    expect(q.adults).toBe(3);
    expect(q.children).toBe(0);
    expect(q.infants).toBe(0);
  });
});

describe('flights_section pick', () => {
  const BLOCK = [
    'Your flights', '1', 'flight available', 'OUT', 'Wed', '12', 'May', '2027', '11:10', 'Manchester', 'MAN', 'Direct', '9', 'h', '40', 'm',
    '14:50', 'Montego Bay', 'MBJ', 'TUI Airways', 'RTN', 'Wed', '26', 'May', '2027', '16:50', 'Montego Bay', 'MBJ', 'Direct', '8', 'h', '50', 'm',
    '07:40', 'Manchester', 'MAN', 'TUI Airways',
  ].join('\n');
  const url = 'https://tui.example/deal';
  const page = (block: string) => ['Holiday summary', 'Hotel Riu', 'Your room', block, 'Your hotel', 'Riu Palace'].join('\n');
  const flightsPick = (value: string, over: Partial<PickedField> = {}) =>
    pick({ field: 'flights_section', value, linesBefore: ['Holiday summary', 'Hotel Riu', 'Your room'], linesAfter: ['Your hotel', 'Riu Palace'], ...over });

  it('stores startLabel "Your flights" and an end label on spec.flightsSection, not in fields', () => {
    const text = page(BLOCK);
    const res = deriveSpecFromPicks([flightsPick(BLOCK)], { url, title: 't', text });
    expect(res.problems).toEqual([]);
    expect(res.spec.fields).toEqual({});
    expect(res.derived).toEqual([]);
    expect(res.spec.flightsSection).toMatchObject({ startLabel: 'Your flights', endLabel: 'Your hotel', origin: 'picked' });
    expect(res.spec.flightsSection?.sampleText).toBe(BLOCK);
  });

  it('truncates the sample to 2000 chars', () => {
    const long = ['Your flights', ...Array.from({ length: 400 }, (_, i) => 'line ' + i)].join('\n');
    const res = deriveSpecFromPicks([flightsPick(long)], { url, title: 't', text: page(long) });
    expect(res.spec.flightsSection?.sampleText?.length).toBe(2000);
  });

  it('falls back to the nearest stable line before a heading-less block', () => {
    const block = BLOCK.split('\n').slice(3).join('\n');
    const text = ['Holiday summary', 'Your flights', block, 'Your hotel'].join('\n');
    const res = deriveSpecFromPicks([flightsPick(block, { linesBefore: ['Holiday summary', 'Your flights'], linesAfter: ['Your hotel'] })], { url, title: 't', text });
    expect(res.problems).toEqual([]);
    expect(res.spec.flightsSection?.startLabel).toBe('Your flights');
  });

  it('rejects an unstable first line and reports a problem when nothing stable precedes it', () => {
    const block = ['Wed 12 May 2027', 'OUT', '11:10', 'MAN', 'MBJ'].join('\n');
    const res = deriveSpecFromPicks([flightsPick(block, { linesBefore: ['£1,200', '14:50'], linesAfter: [] })], { url, title: 't', text: block });
    expect(res.spec.flightsSection).toBeUndefined();
    expect(res.problems).toHaveLength(1);
    expect(res.problems[0].field).toBe('flights_section');
    expect(res.problems[0].reason).toContain("couldn't find a stable heading");
  });

  it('reports a problem when the labels do not locate the picked block in the capture', () => {
    const res = deriveSpecFromPicks([flightsPick(BLOCK)], { url, title: 't', text: 'Holiday summary\nSomething else entirely' });
    expect(res.spec.flightsSection).toBeUndefined();
    expect(res.problems[0].reason).toContain('was not found');
  });

  it('derives the end label from the page lines, never from a line inside the block', () => {
    const text = page(BLOCK);
    const res = deriveSpecFromPicks([flightsPick(BLOCK, { linesAfter: ['Direct'] })], { url, title: 't', text });
    expect(res.problems).toEqual([]);
    expect(res.spec.flightsSection?.endLabel).toBe('Your hotel');
  });

  it('merge overwrites an existing flightsSection and reports it as applied', () => {
    const existing: ExtractionSpec = {
      version: 1,
      fields: {},
      flightsSection: { startLabel: 'Old heading', origin: 'picked', pickedAt: '2026-01-01T00:00:00.000Z' },
    };
    const res = deriveSpecFromPicks([flightsPick(BLOCK)], { url, title: 't', text: page(BLOCK) });
    const merged = mergePickedIntoSpec(existing, res.spec, res.derived);
    expect(merged.spec.flightsSection?.startLabel).toBe('Your flights');
    expect(merged.applied).toEqual([
      { field: 'flights_section', strategy: 'section-anchor', confidence: 'high', verifiedValue: 'Your flights', replaced: 'picked' },
    ]);
    expect(merged.preserved).not.toContain('flightsSection');
  });

  it('merge keeps an existing flightsSection when the picks did not include one', () => {
    const existing: ExtractionSpec = {
      version: 1,
      fields: {},
      flightsSection: { startLabel: 'Old heading', origin: 'picked', pickedAt: '2026-01-01T00:00:00.000Z' },
    };
    const merged = mergePickedIntoSpec(existing, { version: 1, fields: {} }, []);
    expect(merged.spec.flightsSection?.startLabel).toBe('Old heading');
    expect(merged.preserved).toContain('flightsSection');
  });
});

// ─── USAirtours trip summary (real capture facts) ────────────────────────────
describe('deriveSpecFromPicks — USAirtours multi-line picks and long anchors', () => {
  const url = 'https://online.usairtours.co.uk/summary.xhtml?tripId=10';
  const title = 'Trip summary - USAirtours';
  const text = [
    'Your trip',
    '2 Adults + 1 Children (16 years old)',
    '21 Aug 2027 - 27 Aug 2027',
    'Edit search',
    'Nights',
    '5',
    'Transports',
    '2',
    'Accommodations',
    '1',
    'Rent a car',
    '5',
    'Add',
    'Rent a car',
    '5',
    'Moxy NYC Times Square',
    'New York City NY - Show on map > 2.5 km from selected location',
    '8.5',
    'Booking details',
    'Moxy NYC Times Square',
    'Free cancellation',
  ].join('\n');
  const ctx: PickerCaptureContext = { url, title, text };

  const nightsPick = pick({
    field: 'no_of_nights',
    value: 'Nights\n5',
    textIndex: text.indexOf('Nights\n5'),
    lineIndex: 30,
    linesBefore: ['2 Adults + 1 Children (16 years old)', '21 Aug 2027 - 27 Aug 2027', 'Edit search'],
    linesAfter: ['Transports', '2'],
  });
  const accommodationPick = pick({
    field: 'accommodation',
    value: 'Moxy NYC Times Square',
    textIndex: text.indexOf('Moxy NYC Times Square'),
    tag: 'B',
    occurrenceIndex: 0,
    occurrenceCount: 2,
    linesBefore: ['Add', 'Rent a car', '5'],
    linesAfter: ['New York City NY - Show on map > 2.5 km from selected location', '8.5'],
  });

  it('"Nights\n5" yields a label-anchored rule that captures 5 (number transform), safe', () => {
    const res = deriveSpecFromPicks([nightsPick], ctx);
    expect(res.problems).toEqual([]);
    const d = res.derived[0];
    expect(d.strategy).toBe('label-anchored');
    expect(d.rule.transform).toBe('number');
    expect(d.rule.verifiedValue).toBe('5');
    expect(d.rule.regex).toContain('Nights');
    expect(new RegExp(d.rule.regex!, 'i').exec(text)?.[1]).toBe('5');
    expect(findUnsafeRules(res.spec)).toEqual([]);
    expect(runExtractionSpec(res.spec, { url, title, text }, 'x').no_of_nights).toBe(5);
  });

  it('"Moxy NYC Times Square" is anchored on a short fragment of the following long line', () => {
    const res = deriveSpecFromPicks([accommodationPick], ctx);
    expect(res.problems).toEqual([]);
    const d = res.derived[0];
    expect(d.strategy).toBe('label-after');
    expect(d.rule.regex).toContain('Show[ \\t]+on[ \\t]+map');
    expect(d.rule.regex).not.toMatch(/\d\.\d|km|New York/);
    expect(d.confidence).not.toBe('high');
    expect(new RegExp(d.rule.regex!, 'i').exec(text)?.[1]).toBe('Moxy NYC Times Square');
    expect(findUnsafeRules(res.spec)).toEqual([]);
  });

  it('never anchors on a fragment that is not unique on the page', () => {
    const dup = `${text}\nOther hotel\nPlaza\nLondon - Show on map > 1 km`;
    const res = deriveSpecFromPicks([accommodationPick], { url, title, text: dup });
    // "Show on map" now starts two lines, so it must not be used; any rule that
    // still verifies is built on a different, unique phrase.
    for (const d of res.derived) expect(d.rule.regex).not.toContain('Show');
  });

  it('a long preceding line is anchored by a fragment too', () => {
    const t = ['Intro', 'Tower Hotel - Show on map > 3.1 km from centre', 'Moxy NYC Times Square', 'Next'].join('\n');
    const res = deriveSpecFromPicks(
      [pick({ field: 'accommodation', value: 'Moxy NYC Times Square', textIndex: t.indexOf('Moxy'), linesBefore: ['Intro', 'Tower Hotel - Show on map > 3.1 km from centre'] })],
      { url, title, text: t },
    );
    expect(res.problems).toEqual([]);
    expect(res.derived[0].rule.regex).toContain('Show[ \\t]+on[ \\t]+map');
    expect(findUnsafeRules(res.spec)).toEqual([]);
  });

  it('a multi-line value whose first line is not a label still fails with the no-candidate reason', () => {
    const value = 'This first line is far too long to be a label\n5';
    const t = `${value}\nMore`;
    const res = deriveSpecFromPicks([pick({ field: 'no_of_nights', value, textIndex: 0 })], { url, title, text: t });
    expect(res.derived).toEqual([]);
    expect(res.problems[0].reason).toContain('no candidate strategy');
    expect(res.problems[0].reason).toContain(value);
  });

  it('a multi-line pick with a label but a multi-line remainder is not turned into a rule', () => {
    const value = 'Nights\n5\nTransports';
    const res = deriveSpecFromPicks([pick({ field: 'no_of_nights', value, textIndex: text.indexOf('Nights') })], ctx);
    expect(res.derived).toEqual([]);
    expect(res.problems[0].reason).toContain('no candidate strategy');
  });

  it('a *_section multi-line pick is untouched by label-led handling (still a section, no field rule)', () => {
    const block = ['Your flights', 'OUT', 'Manchester', 'MAN', 'RTN', 'Manchester', 'MAN'].join('\n');
    const t = ['Holiday summary', 'Your room', block, 'Your hotel', 'Riu Palace'].join('\n');
    const res = deriveSpecFromPicks(
      [pick({ field: 'flights_section', value: block, textIndex: t.indexOf('Your flights'), linesBefore: ['Holiday summary', 'Your room'], linesAfter: ['Your hotel', 'Riu Palace'] })],
      { url, title: 't', text: t },
    );
    expect(res.derived).toEqual([]);
    expect(res.spec.fields).toEqual({});
    expect(res.spec.flightsSection?.startLabel).toBe('Your flights');
  });
});
