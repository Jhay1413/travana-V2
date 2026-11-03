import { describe, expect, it } from 'vitest';
import { isPlausibleSectionParse, looksMultiLeg, runExtractionSpecDetailed } from './extraction.interpreter';
import { deriveSpecFromPicks, type PickedField } from './picker-spec';
import { verifyAiFlightLegs, type AiFlightLeg } from './flight-legs.validate';
import { savePicksValidator } from '../scraper.validator';
import type { ExtractionSpec } from './extraction.types';
import { TUI_DEEP_TEXT } from './tui-flights.fixture';

const sectionSpec = (startLabel: string, endLabel?: string): ExtractionSpec => ({
  version: 1,
  fields: {},
  flightsSection: { startLabel, endLabel, origin: 'picked', pickedAt: '2026-10-01T00:00:00.000Z' },
});
const run = (spec: ExtractionSpec, text: string, deepText?: string) =>
  runExtractionSpecDetailed(spec, { title: '', text, url: 'https://tui.example/deal', deepText }, 'x');

const EXPECTED = {
  out: {
    flight_type: 'outbound', departing_airport: 'MAN', departing_airport_name: 'Manchester', departure_date_time: '2027-05-12T11:10',
    arrival_airport: 'MBJ', arrival_airport_name: 'Montego Bay', arrival_date_time: '2027-05-12T14:50',
  },
  ret: {
    flight_type: 'return', departing_airport: 'MBJ', departing_airport_name: 'Montego Bay', departure_date_time: '2027-05-26T16:50',
    arrival_airport: 'MAN', arrival_airport_name: 'Manchester', arrival_date_time: '2027-05-27T07:40',
  },
};

describe('TUI deepText end to end (parsers only, no AI)', () => {
  it('reads correct legs when the cards sit in deepText only', () => {
    const { quote, flightsSection } = run(sectionSpec('Durations', 'Selected'), 'Holiday\nHotel Riu\n£3,000', TUI_DEEP_TEXT);
    expect(quote.flights).toHaveLength(2);
    expect(quote.flights[0]).toMatchObject(EXPECTED.out);
    expect(quote.flights[1]).toMatchObject(EXPECTED.ret);
    expect(flightsSection).toMatchObject({ found: true, parsedFromSection: true, multiLeg: false, fromApiJson: false });
  });

  it('reads the same legs when the cards are in the visible text', () => {
    const { quote } = run(sectionSpec('Durations', 'Selected'), TUI_DEEP_TEXT);
    expect(quote.flights[0]).toMatchObject(EXPECTED.out);
    expect(quote.flights[1]).toMatchObject(EXPECTED.ret);
  });

  it('prefers a candidate that parses over an earlier hidden duplicate that does not', () => {
    const { quote } = run(sectionSpec('Durations', 'Selected'), 'Durations\nnothing here\nSelected', TUI_DEEP_TEXT);
    expect(quote.flights[1]).toMatchObject(EXPECTED.ret);
  });
});

describe('isPlausibleSectionParse', () => {
  const good = {
    destName: 'Montego Bay', destCode: 'MBJ', homeName: 'Manchester', homeCode: 'MAN',
    outDepart: '2027-05-12T11:10', outArrive: '2027-05-12T14:50', retDepart: '2027-05-26T16:50', retArrive: '2027-05-27T07:40',
  };
  const text = 'MAN MBJ';
  it('accepts a sane read', () => expect(isPlausibleSectionParse(good, text)).toBe(true));
  it('rejects an airline token as an airport', () => expect(isPlausibleSectionParse({ ...good, destCode: 'TUI' }, text + ' TUI')).toBe(false));
  it('rejects same departure and arrival airport', () => expect(isPlausibleSectionParse({ ...good, destCode: 'MAN' }, text)).toBe(false));
  it('rejects a code that is not printed as its own token', () => expect(isPlausibleSectionParse(good, 'MAN MBJX')).toBe(false));
  it('rejects arrival at or before departure', () => {
    expect(isPlausibleSectionParse({ ...good, retArrive: '2027-05-26T07:40' }, text)).toBe(false);
    expect(isPlausibleSectionParse({ ...good, outArrive: '2027-05-12T11:10' }, text)).toBe(false);
  });
});

describe('section label lookup', () => {
  it('prefers an exact line over a line that merely starts with the label', () => {
    const text = ['Flight details and baggage', 'unrelated', 'Flight details', 'OUT'].join('\n');
    const { flightsSection } = run(sectionSpec('Flight details'), text);
    expect(flightsSection?.text?.startsWith('Flight details\nOUT')).toBe(true);
  });
  it('falls back to a line start when no line is equal', () => {
    const { flightsSection } = run(sectionSpec('Flight details'), 'x\nFlight details and baggage\nOUT');
    expect(flightsSection?.text?.startsWith('Flight details and baggage')).toBe(true);
  });
});

describe('looksMultiLeg (structure, not raw counts)', () => {
  it('is false for the TUI section', () => {
    expect(looksMultiLeg(TUI_DEEP_TEXT.slice(TUI_DEEP_TEXT.indexOf('Durations'), TUI_DEEP_TEXT.indexOf('Selected')))).toBe(false);
  });
  it('ignores prices, durations, aircraft types and postcodes', () => {
    expect(looksMultiLeg('MAN to MBJ\n11:10 14:50 £1.50 duration: 9:40 A320 B737 M22 5WS 08:00 09:00 10:00')).toBe(false);
  });
  it('is true for a three-airport connection', () => {
    expect(looksMultiLeg('MAN 06:00 AMS 08:00 AMS 09:30 MBJ 12:45')).toBe(true);
  });
});

describe('picked label choice', () => {
  const p = (over: Partial<PickedField>): PickedField => ({
    field: 'flights_section', value: '', textIndex: 0, lineIndex: 0, linesBefore: [], linesAfter: [], occurrenceIndex: 0, occurrenceCount: 1,
    tag: 'div', ancestorTags: [], siblingIndex: 0, ...over,
  });
  const block = ['OUT', 'Wed 12 May 2027', '11:10', 'MAN', 'MBJ', '14:50'].join('\n');

  it('skips short or non-word lines like "pp" and a label that repeats on the page', () => {
    const text = ['Durations', 'pp', 'Direct', block, 'Direct', 'Selected'].join('\n');
    const res = deriveSpecFromPicks([p({ value: block, linesBefore: ['Durations', 'pp', 'Direct'], linesAfter: ['Direct', 'Selected'] })], { url: 'https://a.test', title: '', text });
    expect(res.problems).toEqual([]);
    expect(res.spec.flightsSection).toMatchObject({ startLabel: 'Durations', endLabel: 'Selected' });
  });

  it('reports a problem when the only heading appears twice', () => {
    const text = ['Your flights', 'x', 'Your flights', block].join('\n');
    const res = deriveSpecFromPicks([p({ value: block, linesBefore: ['Your flights'] })], { url: 'https://a.test', title: '', text });
    expect(res.spec.flightsSection).toBeUndefined();
    expect(res.problems[0].reason).toContain('more than once');
  });
});

describe('verifyAiFlightLegs tightening', () => {
  const TEXT = 'Your flights OUT Wed 12 May 2027 11:10 Manchester MAN 14:50 Montego Bay MBJ BY123 RTN 26 May 2027 16:50 MBJ 07:40 MAN £1.50';
  const leg = (over: Partial<AiFlightLeg>): AiFlightLeg => ({
    direction: 'outbound', flight_number: '', departing_airport: 'MAN', departing_airport_name: 'Manchester', departure_date: '2027-05-12',
    departure_time: '11:10', arrival_airport: 'MBJ', arrival_airport_name: 'Montego Bay', arrival_date: '2027-05-12', arrival_time: '14:50', ...over,
  });
  const ctx = { travelDate: '2027-05-12', returnDate: '2027-05-26' };

  it('accepts the baseline', () => expect(verifyAiFlightLegs([leg({})], TEXT, ctx)).toHaveLength(1));
  it('requires the printed year to equal the leg year', () => {
    expect(verifyAiFlightLegs([leg({ departure_date: '2026-05-12', arrival_date: '2026-05-12' })], TEXT, {})).toEqual([]);
  });
  it('reads an earlier arrival time with no arrival date as the next day', () => {
    const out = verifyAiFlightLegs([leg({ arrival_date: '', departure_time: '14:50', arrival_time: '11:10' })], TEXT, ctx);
    expect(out[0].arrival_date_time).toBe('2027-05-13T11:10');
  });
  it('rejects an arrival before departure and equal times on one date', () => {
    expect(verifyAiFlightLegs([leg({ departure_time: '14:50', arrival_time: '11:10', arrival_date: '2027-05-12' })], TEXT, ctx)).toEqual([]);
    expect(verifyAiFlightLegs([leg({ departure_time: '11:10', arrival_time: '11:10' })], TEXT, ctx)).toEqual([]);
  });
  it('validates the flight number shape and whole-token presence', () => {
    expect(verifyAiFlightLegs([leg({ flight_number: 'BY 123' })], TEXT, ctx)).toHaveLength(1);
    expect(verifyAiFlightLegs([leg({ flight_number: 'BY12' })], TEXT, ctx)).toEqual([]);
    expect(verifyAiFlightLegs([leg({ flight_number: 'TOM123' })], TEXT, ctx)).toEqual([]);
  });
  it('requires airport names of 4+ chars as whole words', () => {
    expect(verifyAiFlightLegs([leg({ departing_airport_name: 'Man' })], TEXT, ctx)).toEqual([]);
    expect(verifyAiFlightLegs([leg({ departing_airport_name: 'Manche' })], TEXT, ctx)).toEqual([]);
  });
  it('does not read a price as a time', () => {
    expect(verifyAiFlightLegs([leg({ departure_time: '01:50' })], TEXT, ctx)).toEqual([]);
  });
  it('rejects identical departure and arrival airports', () => {
    expect(verifyAiFlightLegs([leg({ arrival_airport: 'MAN', arrival_airport_name: '' })], TEXT, ctx)).toEqual([]);
  });
  it('only falls back to the deal date for the first undated leg of a direction', () => {
    const undated = leg({ departure_date: '', arrival_date: '' });
    const out = verifyAiFlightLegs([undated, undated], TEXT, ctx);
    expect(out).toHaveLength(1);
  });
});

describe('savePicksValidator', () => {
  it('truncates an over-long pick value instead of rejecting the request', () => {
    const parsed = savePicksValidator.parse({
      body: {
        url: 'https://a.test/x',
        text: 'x',
        picked: [{
          field: 'flights_section', value: 'a'.repeat(9000), textIndex: 0, lineIndex: 0, linesBefore: [], linesAfter: [], occurrenceIndex: 0,
          occurrenceCount: 1, tag: 'div', ancestorTags: [], siblingIndex: 0,
        }],
      },
      query: {},
      params: {},
    });
    expect(parsed.body.picked[0].value).toHaveLength(8000);
  });
});

// ─── The real TUI capture shape: cards exist ONLY in deepText ──────────────────
describe('TUI: picking the flights section when the cards are not in the visible text', () => {
  const VISIBLE = [
    'Reasons to book with TUI', 'Free child places', 'Holiday dates & flights', 'Dates', 'Durations', 'Your room', 'Room1:2Adults',
    ...Array.from({ length: 12 }, (_, i) => `More page copy ${i + 1}`),
  ].join('\n');

  const deepFor = (o: { outDate: string; retDate: string; outDay: string[]; retDay: string[]; from: [string, string]; to: [string, string]; times: [string, string, string, string] }): string =>
    [
      'Dates', '5 nights', '-£701', 'pp', 'Durations',
      'Out summary prose line that is long enough to be rejected as a heading because it runs well past eighty characters in total length.',
      'OUT', ...o.outDay, o.times[0], o.from[0], o.from[1], 'Direct', '9', 'h', '40', 'm', o.times[1], o.to[0], o.to[1], 'TUI Airways',
      'RTN', ...o.retDay, o.times[2], o.to[0], o.to[1], 'Direct', '8', 'h', '50', 'm', o.times[3], o.from[0], o.from[1], 'TUI Airways',
      'Selected', 'Your flights', '1', 'flight available', 'Your room',
    ].join('\n');

  const dealA = deepFor({
    outDate: '', retDate: '', outDay: ['Wed', '12', 'May', '2027'], retDay: ['Wed', '26', 'May', '2027'],
    from: ['Manchester', 'MAN'], to: ['Montego Bay', 'MBJ'], times: ['11:10', '14:50', '16:50', '07:40'],
  });
  const blockOf = (deep: string): string => {
    const start = deep.indexOf('\nOUT\n') + 1;
    const endMarker = 'TUI Airways';
    return deep.slice(start, deep.lastIndexOf(endMarker) + endMarker.length);
  };
  const pick = (value: string): PickedField => ({
    field: 'flights_section', value, textIndex: -1, lineIndex: -1, linesBefore: [], linesAfter: [], occurrenceIndex: -1, occurrenceCount: 0,
    tag: 'DIV', ancestorTags: [], siblingIndex: 0,
  });

  it('derives from deepText (textIndex -1) and a later, different deal imports with the parsers only', () => {
    const res = deriveSpecFromPicks([pick(blockOf(dealA))], { url: 'https://tui.example/a', title: '', text: VISIBLE, deepText: dealA });
    expect(res.problems).toEqual([]);
    expect(res.spec.flightsSection).toMatchObject({ startLabel: 'Durations', endLabel: 'Selected', source: 'deepText' });

    const dealB = deepFor({
      outDate: '', retDate: '', outDay: ['Sat', '3', 'Jul', '2027'], retDay: ['Sat', '17', 'Jul', '2027'],
      from: ['Newcastle', 'NCL'], to: ['Faro', 'FAO'], times: ['06:30', '10:05', '11:00', '14:45'],
    });
    const { quote, flightsSection } = runExtractionSpecDetailed(res.spec, { title: '', text: VISIBLE, url: 'https://tui.example/b', deepText: dealB }, 'x');
    expect(flightsSection).toMatchObject({ found: true, parsedFromSection: true, multiLeg: false });
    expect(quote.flights).toHaveLength(2);
    expect(quote.flights[0]).toMatchObject({
      departing_airport: 'NCL', arrival_airport: 'FAO', departure_date_time: '2027-07-03T06:30', arrival_date_time: '2027-07-03T10:05',
    });
    expect(quote.flights[1]).toMatchObject({
      departing_airport: 'FAO', arrival_airport: 'NCL', departure_date_time: '2027-07-17T11:00', arrival_date_time: '2027-07-17T14:45',
    });
  });

  it('searches the verified source first even though the visible text also has the heading', () => {
    const spec: ExtractionSpec = { ...sectionSpec('Durations', 'Selected'), flightsSection: { ...sectionSpec('Durations', 'Selected').flightsSection!, source: 'deepText' } };
    const { flightsSection } = runExtractionSpecDetailed(spec, { title: '', text: VISIBLE, url: 'https://tui.example/a', deepText: dealA }, 'x');
    expect(flightsSection?.text).toContain('MBJ');
  });
});
