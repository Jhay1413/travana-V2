import { describe, expect, it } from 'vitest';
import { runExtractionSpec } from './extraction.interpreter';
import type { ExtractionSpec } from './extraction.types';
import type { ScrapedQuoteJson } from '../../easyjet/easyjet.types';
import { supplierScraperSeed } from '../../../../../scripts/seed-data/supplier-scrapers';

// Cross-supplier regression scenarios: the direction-heading pass, the section
// parsers and the overnight marker must never change what HEAD produced for other
// suppliers' layouts (booking JSON, stacked itineraries, OUT/RTN cards, modals).

const seed: Record<string, ExtractionSpec> = Object.fromEntries(
  (supplierScraperSeed as unknown as { supplierName: string; config: { extraction: ExtractionSpec } }[]).map((s) => [s.supplierName, s.config.extraction]),
);
const EMPTY: ExtractionSpec = { version: 1, fields: {} };
const U = 'https://x.test/deal';
const run = (spec: ExtractionSpec, ctx: { text: string; url?: string; apiJson?: unknown; flightsText?: string }): ScrapedQuoteJson =>
  runExtractionSpec(spec, { title: '', url: U, ...ctx }, 'x');
const compact = (q: ScrapedQuoteJson): string[] =>
  q.flights.map((f) => `${f.flight_type[0]}:${f.flight_number || '-'} ${f.departing_airport}->${f.arrival_airport} ${f.departure_date_time}/${f.arrival_date_time}`);

const STN_PRG = 'o:- STN->PRG 2026-08-30T06:00/2026-08-30T08:50';
const PRG_STN = 'r:- PRG->STN 2026-09-05T06:10/2026-09-05T07:05';

const tuiCards = (codeFirst: boolean, tail: string[] = []): string =>
  [
    'Your flights', 'OUT', 'Sun 30 Aug 2026', '06:00',
    ...(codeFirst ? ['STN', 'Direct', '1h 50m', '08:50', 'PRG'] : ['Direct', '1h 50m', '08:50', 'London Stansted', 'STN', 'Prague', 'PRG']),
    'Ryanair', 'RTN', 'Sat 05 Sep 2026', '06:10',
    ...(codeFirst ? ['PRG', 'Direct', '1h 55m', '07:05', 'STN'] : ['Direct', '1h 55m', '07:05', 'Prague', 'PRG', 'London Stansted', 'STN']),
    'Ryanair', 'Selected', 'Your room', ...tail,
  ].join('\n');

describe('R1: a bare OUT card marker is never a direction heading (TUI)', () => {
  const tuiUrl = 'https://www.tui.co.uk/destinations/x/hotel?when=30-08-2026&duration=6';
  it('G2: TUI seed spec, code right after the time, gives exactly the old 2 legs', () => {
    expect(compact(run(seed.Tui, { text: tuiCards(true), url: tuiUrl }))).toEqual([STN_PRG, PRG_STN]);
  });
  it('G1/G3: name+code cards and the empty spec are unchanged', () => {
    expect(compact(run(seed.Tui, { text: tuiCards(false), url: tuiUrl }))).toEqual([STN_PRG, PRG_STN]);
    expect(compact(run(EMPTY, { text: tuiCards(true), url: tuiUrl }))).toEqual([STN_PRG, PRG_STN]);
  });
});

describe('R2: booking JSON and correct generic parses beat the direction-heading pass', () => {
  const leg = (f: string, fc: string, t: string, tc: string, d: string, dt: string, at: string, no: string) => ({
    departureAirport: f, departureAirportCode: fc, arrivalAirport: t, arrivalAirportCode: tc,
    schedule: { departureDate: d, departureTime: dt.replace(':', ''), arrivalDate: d, arrivalTime: at.replace(':', ''), formattedDepartureTime: dt, formattedArrivalTime: at },
    carrier: { name: 'Ryanair', carrierCode: 'FR', flightNumber: no },
  });
  const apiJson = {
    packageData: {
      itinerary: {
        outbounds: [leg('London Stansted', 'STN', 'Prague', 'PRG', '30-08-2026', '06:00', '08:50', 'FR1013')],
        inbounds: [leg('Prague', 'PRG', 'London Stansted', 'STN', '05-09-2026', '06:10', '07:05', 'FR1427')],
      },
    },
  };
  const tuiUrl = 'https://www.tui.co.uk/destinations/x/hotel?when=30-08-2026&duration=6';
  const JSON_LEGS = ['o:FR1013 STN->PRG 2026-08-30T06:00/2026-08-30T08:50', 'r:FR1427 PRG->STN 2026-09-05T06:10/2026-09-05T07:05'];

  it('J2: JSON + an "alternative flights" widget with Outbound/Return headings keeps the JSON legs', () => {
    const widget = ['Your flights', 'Change your flights', 'Outbound', '14:00', 'London Gatwick (LGW)', '2h', '17:00', 'Prague (PRG)', '+ 25pp', 'Return', '20:00', 'Prague (PRG)', '21:00', 'London Gatwick (LGW)', '+ 25pp', 'Your room'].join('\n');
    expect(compact(run(seed.Tui, { text: widget, url: tuiUrl, apiJson }))).toEqual(JSON_LEGS);
  });
  it('J3: JSON + code-first OUT/RTN cards keeps the JSON legs', () => {
    expect(compact(run(seed.Tui, { text: tuiCards(true), url: tuiUrl, apiJson }))).toEqual(JSON_LEGS);
  });
  it('J4: an easyJet stacked itinerary + an Outbound alternative list keeps the stacked legs', () => {
    const ezy = ['Your flights', 'Fri 14th Aug 2026', 'EZY2051', '17:00', '23:25', 'Manchester', '(MAN)', 'Rhodes, Diagoras', '(RHO)', 'Sat 22nd Aug 2026', 'EZY2052', '00:25', '02:55', 'Rhodes, Diagoras', '(RHO)', 'Manchester', '(MAN)', 'Selected'];
    const alt = ['Outbound', 'Change flight', '06:00', 'Manchester (MAN)', '3h 25m', '10:25', 'Rhodes (RHO)', '12'];
    expect(compact(run(seed.Easyjet, { text: [...ezy, ...alt].join('\n'), url: 'https://x.test/d?departureDate=2026-08-14&nights=8' }))).toEqual([
      'o:EZY2051 MAN->RHO 2026-08-14T17:00/2026-08-14T23:25',
      'r:EZY2052 RHO->MAN 2026-08-22T00:25/2026-08-22T02:55',
    ]);
  });
  it('C2: the same stacked itinerary with the empty spec is unchanged', () => {
    const ezy = ['Your flights', 'Fri 14th Aug 2026', 'EZY2051', '17:00', '23:25', 'Manchester', '(MAN)', 'Rhodes, Diagoras', '(RHO)', 'Sat 22nd Aug 2026', 'EZY2052', '00:25', '02:55', 'Rhodes, Diagoras', '(RHO)', 'Manchester', '(MAN)', 'Selected'];
    expect(compact(run(EMPTY, { text: [...ezy, 'Outbound', 'Change flight', '06:00', 'Manchester (MAN)', '3h 25m', '10:25', 'Rhodes (RHO)', '12'].join('\n') }))).toEqual([
      'o:EZY2051 MAN->RHO 2026-08-14T17:00/2026-08-14T23:25',
      'r:EZY2052 RHO->MAN 2026-08-22T00:25/2026-08-22T02:55',
    ]);
  });
  it('B2: a Jet2 modal beats a page widget with Departure/Return headings', () => {
    const jet2 = ['Going Out', 'Newcastle  Reus (Barcelona South) REU', 'Depart: Sun 06 Sep 2026 at 16:30', 'Arrive: Sun 06 Sep 2026 at 20:15', 'Coming Back', 'Reus (Barcelona South) REU  Newcastle', 'Depart: Sat 12 Sep 2026 at 11:10', 'Arrive: Sat 12 Sep 2026 at 12:55'].join('\n');
    const form = ['Search', 'Departure', '10:00', 'London Gatwick (LGW)', '12:00', 'Palma (PMI)', 'Return', '18:00', 'Palma (PMI)', '20:00', 'London Gatwick (LGW)'].join('\n');
    expect(compact(run(EMPTY, { text: form, flightsText: jet2 }))).toEqual(['o:- ->REU 2026-09-06T16:30/2026-09-06T20:15', 'r:- REU-> 2026-09-12T11:10/2026-09-12T12:55']);
  });
});

describe('R3: the overnight marker is read inside the card only', () => {
  it('A4: "next day" in hotel copy after the card does not move the return arrival', () => {
    expect(compact(run(EMPTY, { text: tuiCards(false, ['Late checkout until noon the next day is available.']) }))).toEqual([STN_PRG, PRG_STN]);
  });
  it('A5: a "+2 days" promo after the card is ignored', () => {
    expect(compact(run(EMPTY, { text: tuiCards(false, ['Extend your stay +2 days for 99']) }))).toEqual([STN_PRG, PRG_STN]);
  });
  it('A6: a "next day" 700 chars after the card is ignored', () => {
    expect(compact(run(EMPTY, { text: tuiCards(false, ['x'.repeat(700), 'next day']) }))).toEqual([STN_PRG, PRG_STN]);
  });
  it('still shifts for a real "+1 day" / "arrives the next day" inside the card', () => {
    const text = ['OUT', 'Wed 12 May 2027', '11:10', 'Manchester', 'MAN', 'Direct', '14:50', 'Montego Bay', 'MBJ', 'RTN', 'Wed 26 May 2027', '+1 day', '16:50', 'Montego Bay', 'MBJ', '07:40', 'Manchester', 'MAN', 'Selected'].join('\n');
    expect(compact(run(EMPTY, { text }))[1]).toBe('r:- MBJ->MAN 2027-05-26T16:50/2027-05-27T07:40');
  });
});

describe('R4: a return is never dated on the outbound day when the nights are unknown', () => {
  const rcUrl = 'https://x.test/c?sailDate=2027-09-12';
  const block = (title: string) => ['Your cruise', title, 'Departure', '09:05', 'London Heathrow (LHR)', '13:40', 'Miami (MIA)', 'Return', '18:00', 'Miami (MIA)', '07:30', 'London Heathrow (LHR)', 'Price'].join('\n');
  it('E1: no nights -> no return leg (and no bogus same-day return)', () => {
    const flights = compact(run(seed.Royalcaribbean, { text: block('Sailing Date'), url: rcUrl }));
    expect(flights.some((f) => f.startsWith('r:'))).toBe(false);
  });
  it('H2: a package page with no nights and no dates on the page -> no return leg', () => {
    const text = ['Departure', '09:05', 'London Gatwick (LGW)', '12:40', 'Palma (PMI)', 'Return', '18:00', 'Palma (PMI)', '19:30', 'London Gatwick (LGW)'].join('\n');
    const flights = compact(run(EMPTY, { text, url: 'https://x.test/p?date=2027-06-01' }));
    expect(flights.some((f) => f.startsWith('r:'))).toBe(false);
  });
  it('H1: with the nights known the return is dated from them (unchanged behaviour)', () => {
    const flights = compact(run(seed.Royalcaribbean, { text: block('7 Night Western Caribbean'), url: `${rcUrl}&nights=7` }));
    expect(flights).toEqual(['o:- LHR->MIA 2027-09-12T09:05/2027-09-12T13:40', 'r:- MIA->LHR 2027-09-19T18:00/2027-09-20T07:30']);
  });
});

describe('direction legs must chain', () => {
  it('an out-and-back inside one heading section is not read as a one-way journey', () => {
    const text = ['Departure', '09:05', 'London Gatwick (LGW)', '12:40', 'Palma (PMI)', '13:30', 'Palma (PMI)', '15:00', 'London Gatwick (LGW)', 'Price'].join('\n');
    expect(compact(run(EMPTY, { text, url: 'https://x.test/p?date=2027-06-01' }))).toEqual([]);
  });
});
