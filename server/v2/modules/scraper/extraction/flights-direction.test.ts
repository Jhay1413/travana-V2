import { describe, expect, it } from 'vitest';
import { extractFlightsSection, runExtractionSpecDetailed } from './extraction.interpreter';
import { deriveSpecFromPicks, mergePickedIntoSpec, type PickedField } from './picker-spec';
import { validateQuote } from './extraction.validate';
import type { ExtractionSpec } from './extraction.types';
import type { ScrapedQuoteJson } from '../../easyjet/easyjet.types';
import { DEAL_A, DEAL_B, usaPage, type UsaPage } from './usairtours-flights.fixture';

const URL_A = 'https://usairtours.example/deal/1';

const pick = (field: string, value: string): PickedField => ({
  field, value, textIndex: 0, lineIndex: 0, linesBefore: [], linesAfter: [], occurrenceIndex: 0, occurrenceCount: 1,
  tag: 'DIV', ancestorTags: [], siblingIndex: 0,
});

// The box an agent clicks: from the airline line down to "1 PC".
function blockFrom(pageText: string, airlineLine: string): string {
  const lines = pageText.split('\n').map((l) => l.trim());
  const start = lines.indexOf(airlineLine);
  const end = lines.indexOf('1 PC', start);
  return lines.slice(start, end + 1).join('\n');
}

function deriveBoth(page: UsaPage, ctx: { text: string; deepText?: string }) {
  const source = usaPage(page);
  const out = pick('flights_outbound_section', blockFrom(source, `${page.out[0].airline} - ${page.out[0].flightNo}`));
  const ret = pick('flights_return_section', blockFrom(source, `${page.ret[0].airline} - ${page.ret[0].flightNo}`));
  return deriveSpecFromPicks([out, ret], { url: URL_A, title: '', ...ctx });
}

const run = (spec: ExtractionSpec, text: string, deepText?: string, url = URL_A) =>
  runExtractionSpecDetailed(spec, { title: '', text, url, deepText }, 'x');

const A_LEGS = {
  out: {
    flight_number: 'VS25', flight_type: 'outbound', departing_airport: 'LHR', departing_airport_name: 'Heathrow London',
    departure_date_time: '2027-08-21T20:05', arrival_airport: 'JFK', arrival_airport_name: 'John F Kennedy Intl', arrival_date_time: '2027-08-21T22:50',
  },
  ret: {
    flight_number: 'VS138', flight_type: 'return', departing_airport: 'JFK', departing_airport_name: 'John F Kennedy Intl',
    departure_date_time: '2027-08-26T23:00', arrival_airport: 'LHR', arrival_airport_name: 'Heathrow London', arrival_date_time: '2027-08-27T11:00',
  },
};

describe('USAirtours: derivation of the Outbound / Return Flights picks', () => {
  const text = usaPage(DEAL_A);
  const res = deriveBoth(DEAL_A, { text });

  it('derives whole-line start labels, unique digit-free end labels and a block size', () => {
    expect(res.problems).toEqual([]);
    expect(res.spec.fields).toEqual({});
    expect(res.spec.flightsOutboundSection).toMatchObject({ startLabel: 'Departure', endLabel: 'Accommodation', source: 'text', blockLines: 9 });
    expect(res.spec.flightsReturnSection).toMatchObject({ startLabel: 'Return', endLabel: 'Price per person From', source: 'text', blockLines: 10 });
    expect(res.spec.flightsSection).toBeUndefined();
  });

  it('never lets the outbound section swallow the hotel or the return flight (and vice versa)', () => {
    const out = extractFlightsSection(res.spec, { text }, 'outbound') ?? '';
    const ret = extractFlightsSection(res.spec, { text }, 'return') ?? '';
    expect(out).toContain('VS 25');
    expect(out).toContain('(JFK)');
    expect(out).not.toContain('Moxy');
    expect(out).not.toContain('VS 138');
    expect(ret).toContain('VS 138');
    expect(ret).toContain('+1 day');
    expect(ret).not.toContain('Moxy');
    expect(ret).not.toContain('£1,088');
  });

  it('uses a block-sized window, not a blind one, when there is no unique end label', () => {
    const spec: ExtractionSpec = {
      version: 1, fields: {},
      flightsOutboundSection: { startLabel: 'Departure', origin: 'picked', pickedAt: '2026-10-01T00:00:00.000Z', blockLines: 9 },
    };
    const out = extractFlightsSection(spec, { text }, 'outbound') ?? '';
    expect(out).toContain('1 PC');
    expect(out).not.toContain('Moxy');
    expect(out.length).toBeLessThanOrEqual(1500);
  });

  it('stops the outbound section at the return start label when that comes first', () => {
    const spec: ExtractionSpec = {
      version: 1, fields: {},
      flightsOutboundSection: { startLabel: 'Departure', origin: 'picked', pickedAt: '2026-10-01T00:00:00.000Z', blockLines: 400 },
      flightsReturnSection: { startLabel: 'Return', origin: 'picked', pickedAt: '2026-10-01T00:00:00.000Z' },
    };
    const out = extractFlightsSection(spec, { text }, 'outbound') ?? '';
    expect(out).toContain('Moxy');
    expect(out).not.toContain('VS 138');
  });

  it('derives from deepText when the cards are only there', () => {
    const deep = usaPage({ ...DEAL_A, deep: true });
    const r = deriveBoth({ ...DEAL_A, deep: true }, { text: 'Trip summary\nNights\n5', deepText: deep });
    expect(r.problems).toEqual([]);
    expect(r.spec.flightsOutboundSection).toMatchObject({ startLabel: 'Departure', source: 'deepText' });
    expect(r.spec.flightsReturnSection).toMatchObject({ startLabel: 'Return', source: 'deepText' });
  });

  it('merge stores them, reports them as applied, and overwrites an earlier one', () => {
    const existing: ExtractionSpec = {
      version: 1, fields: {},
      flightsReturnSection: { startLabel: 'Old', origin: 'picked', pickedAt: '2026-01-01T00:00:00.000Z' },
    };
    const merged = mergePickedIntoSpec(existing, res.spec, res.derived);
    expect(merged.spec.flightsReturnSection?.startLabel).toBe('Return');
    expect(merged.applied.map((a) => [a.field, a.strategy, a.replaced])).toEqual([
      ['flights_outbound_section', 'section-anchor', null],
      ['flights_return_section', 'section-anchor', 'picked'],
    ]);
    expect(merged.preserved).not.toContain('flightsReturnSection');
  });
});

describe('USAirtours: import end to end (parsers only)', () => {
  const spec = deriveBoth(DEAL_A, { text: usaPage(DEAL_A) }).spec;

  it('produces exactly the 2 expected legs from the visible text', () => {
    const { quote, directionSections } = run(spec, usaPage(DEAL_A));
    expect(quote.flights).toHaveLength(2);
    expect(quote.flights[0]).toEqual(A_LEGS.out);
    expect(quote.flights[1]).toEqual(A_LEGS.ret);
    expect(quote.travel_date).toBe('2027-08-21');
    expect(directionSections.outbound).toMatchObject({ found: true, parsed: true });
    expect(directionSections.return).toMatchObject({ found: true, parsed: true });
  });

  it('produces the same legs from deepText, where "(LHR)" sits on its own line', () => {
    const deepSpec = deriveBoth({ ...DEAL_A, deep: true }, { text: 'Trip summary\nNights\n5', deepText: usaPage({ ...DEAL_A, deep: true }) }).spec;
    const { quote } = run(deepSpec, 'Trip summary\nNights\n5', usaPage({ ...DEAL_A, deep: true }));
    expect(quote.flights).toEqual([A_LEGS.out, A_LEGS.ret]);
  });

  it('reads a different deal with the same layout (other airports, dates, times, carrier)', () => {
    const { quote } = run(spec, usaPage(DEAL_B));
    expect(quote.flights).toEqual([
      {
        flight_number: 'BA283', flight_type: 'outbound', departing_airport: 'LGW', departing_airport_name: 'Gatwick London',
        departure_date_time: '2027-09-04T10:15', arrival_airport: 'LAX', arrival_airport_name: 'Los Angeles Intl', arrival_date_time: '2027-09-04T13:20',
      },
      {
        flight_number: 'BA282', flight_type: 'return', departing_airport: 'LAX', departing_airport_name: 'Los Angeles Intl',
        departure_date_time: '2027-09-11T17:40', arrival_airport: 'LGW', arrival_airport_name: 'Gatwick London', arrival_date_time: '2027-09-12T11:10',
      },
    ]);
  });

  it('keeps the other direction when one section is not found, and the warning names it', () => {
    const noReturn = usaPage(DEAL_A).replace('\nReturn\n', '\nBack\n').replace('Return transport', 'Back transport');
    const { quote, directionSections } = run(spec, noReturn);
    expect(directionSections.return).toMatchObject({ found: false, parsed: false });
    expect(quote.flights).toEqual([A_LEGS.out]);

    const res = validateQuote(quote as ScrapedQuoteJson, {
      url: URL_A, text: noReturn, spec,
      flightsOutboundSectionFound: directionSections.outbound?.found,
      flightsReturnSectionFound: directionSections.return?.found,
    });
    const issue = res.issues.find((i) => i.field === 'flights_return_section');
    expect(issue?.code).toBe('PICKED_FIELD_MISSED');
    expect(issue?.message).toContain("return flights section you picked on");
    expect(res.issues.some((i) => i.field === 'flights_outbound_section')).toBe(false);
  });

  it('reads a connection inside the return section as 2 return legs', () => {
    const page: UsaPage = {
      ...DEAL_A,
      ret: [
        { airline: 'Virgin Atlantic Airways', flightNo: 'VS 138', dep: '23:00', from: ['John F Kennedy Intl', 'JFK'], duration: '6h', arr: '07:00', to: ['Dublin Airport', 'DUB'], overnight: '+1 day' },
        { airline: 'Aer Lingus', flightNo: 'EI 154', dep: '09:00', from: ['Dublin Airport', 'DUB'], duration: '1h 30m', arr: '10:30', to: ['Heathrow London', 'LHR'] },
      ],
    };
    const { quote } = run(spec, usaPage(page));
    expect(quote.flights.map((f) => f.flight_type)).toEqual(['outbound', 'return', 'return']);
    expect(quote.flights[1]).toMatchObject({ flight_number: 'VS138', departing_airport: 'JFK', arrival_airport: 'DUB', departure_date_time: '2027-08-26T23:00', arrival_date_time: '2027-08-27T07:00' });
    expect(quote.flights[2]).toMatchObject({ flight_number: 'EI154', flight_type: 'return', departing_airport: 'DUB', arrival_airport: 'LHR', departure_date_time: '2027-08-27T09:00', arrival_date_time: '2027-08-27T10:30' });
  });
});

// ─── Scenarios the user hit: no picks / a combined pick on the outbound box only / only an outbound pick ──
describe('USAirtours: both legs without relying on a complete set of picks', () => {
  const variants = [
    { name: 'visible text', text: usaPage(DEAL_A), deepText: undefined as string | undefined, deep: false },
    { name: 'deepText (cards only there)', text: 'Trip summary\nNights\n5', deepText: usaPage({ ...DEAL_A, deep: true }), deep: true },
  ];
  const outBox = (deep: boolean) => blockFrom(usaPage({ ...DEAL_A, deep }), deep ? 'Virgin Atlantic Airways - VS 25' : 'Virgin Atlantic Airways - VS 25');

  for (const v of variants) {
    describe(v.name, () => {
      it('A) no picks at all: the heading pass reads both directions', () => {
        const { quote } = run({ version: 1, fields: {} }, v.text, v.deepText);
        expect(quote.flights).toEqual([A_LEGS.out, A_LEGS.ret]);
      });

      it('B) a combined flights_section picked on the outbound box only still yields both legs', () => {
        const derived = deriveSpecFromPicks([pick('flights_section', outBox(v.deep))], { url: URL_A, title: '', text: v.text, deepText: v.deepText });
        expect(derived.problems).toEqual([]);
        expect(derived.spec.flightsSection).toMatchObject({ startLabel: 'Departure', endLabel: 'Accommodation' });
        const { quote } = run(derived.spec, v.text, v.deepText);
        expect(quote.flights).toEqual([A_LEGS.out, A_LEGS.ret]);
      });

      it('C) only an outbound pick: the return comes from the heading pass', () => {
        const derived = deriveSpecFromPicks([pick('flights_outbound_section', outBox(v.deep))], { url: URL_A, title: '', text: v.text, deepText: v.deepText });
        expect(derived.problems).toEqual([]);
        expect(derived.spec.flightsReturnSection).toBeUndefined();
        const { quote, directionSections } = run(derived.spec, v.text, v.deepText);
        expect(quote.flights).toEqual([A_LEGS.out, A_LEGS.ret]);
        expect(directionSections.return).toBeNull();
      });
    });
  }

  it('never picks a label with a digit, for any kind (no "Transport:  VS25" end label)', () => {
    for (const field of ['flights_section', 'flights_outbound_section', 'flights_return_section']) {
      const text = usaPage(DEAL_A);
      const box = field === 'flights_return_section' ? blockFrom(text, 'Virgin Atlantic Airways - VS 138') : blockFrom(text, 'Virgin Atlantic Airways - VS 25');
      const section = deriveSpecFromPicks([pick(field, box)], { url: URL_A, title: '', text }).spec;
      const stored = section.flightsSection ?? section.flightsOutboundSection ?? section.flightsReturnSection;
      expect(stored).toBeDefined();
      expect(stored?.startLabel).not.toMatch(/\d/);
      expect(stored?.endLabel ?? '').not.toMatch(/\d/);
    }
  });

  it('ignores a stale end label that carries a flight number (older pick)', () => {
    const spec: ExtractionSpec = {
      version: 1, fields: {},
      flightsSection: { startLabel: 'Departure', endLabel: 'Transport:  VS25', origin: 'picked', pickedAt: '2026-10-01T00:00:00.000Z' },
    };
    const cut = extractFlightsSection(spec, { text: usaPage(DEAL_A) }) ?? '';
    expect(cut).toContain('Transport type: 339'); // not cut at the stale line
    const { quote } = run(spec, usaPage(DEAL_A));
    expect(quote.flights).toEqual([A_LEGS.out, A_LEGS.ret]);
  });

  it('does not treat an inline "Departure:" inside a sentence as a heading', () => {
    const { quote } = run({ version: 1, fields: {} }, 'Created: Monday - Departure: Saturday, August 21, 2027\nNothing else of interest here');
    expect(quote.flights).toEqual([]);
  });
});
