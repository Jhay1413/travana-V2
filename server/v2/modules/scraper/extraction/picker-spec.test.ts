import { describe, expect, it } from 'vitest';
import { deriveSpecFromPicks, mergePickedIntoSpec, type DerivedRule, type PickedField, type PickerCaptureContext } from './picker-spec';
import type { ExtractionSpec, FieldRule } from './extraction.types';

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
