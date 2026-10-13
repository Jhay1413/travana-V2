import { describe, expect, it } from 'vitest';
import { addDaysIso, normaliseClockTime, verifyAiFlightLegs, type AiFlightLeg } from './flight-legs.validate';

const SECTION = [
  'Your flights', '1', 'flight available', 'OUT', 'Wed', '12', 'May', '2027', '11:10', 'Manchester', 'MAN', 'Direct', '9', 'h', '40', 'm',
  '14:50', 'Montego Bay', 'MBJ', 'TUI Airways', 'RTN', 'Wed', '26', 'May', '2027', '16:50', 'Montego Bay', 'MBJ', 'Direct', '8', 'h', '50', 'm',
  '07:40', 'Manchester', 'MAN', 'TUI Airways',
].join('\n');

const OUT: AiFlightLeg = {
  direction: 'outbound',
  flight_number: '',
  departing_airport: 'MAN',
  departing_airport_name: 'Manchester',
  departure_date: '2027-05-12',
  departure_time: '11:10',
  arrival_airport: 'MBJ',
  arrival_airport_name: 'Montego Bay',
  arrival_date: '2027-05-12',
  arrival_time: '14:50',
};
const RTN: AiFlightLeg = {
  direction: 'return',
  flight_number: '',
  departing_airport: 'MBJ',
  departing_airport_name: 'Montego Bay',
  departure_date: '2027-05-26',
  departure_time: '16:50',
  arrival_airport: 'MAN',
  arrival_airport_name: 'Manchester',
  arrival_date: '2027-05-27',
  arrival_time: '07:40',
};
const ctx = { travelDate: '2027-05-12', returnDate: '2027-05-26' };

describe('verifyAiFlightLegs', () => {
  it('accepts the real legs of the fixture and maps them to ScrapedFlightJson', () => {
    const out = verifyAiFlightLegs([RTN, OUT], SECTION, ctx);
    expect(out).toEqual([
      {
        flight_number: '', flight_type: 'outbound',
        departing_airport: 'MAN', departing_airport_name: 'Manchester', departure_date_time: '2027-05-12T11:10',
        arrival_airport: 'MBJ', arrival_airport_name: 'Montego Bay', arrival_date_time: '2027-05-12T14:50',
      },
      {
        flight_number: '', flight_type: 'return',
        departing_airport: 'MBJ', departing_airport_name: 'Montego Bay', departure_date_time: '2027-05-26T16:50',
        arrival_airport: 'MAN', arrival_airport_name: 'Manchester', arrival_date_time: '2027-05-27T07:40',
      },
    ]);
  });

  it('accepts an arrival date of travel date + 1 even though the text never states it', () => {
    const overnight = { ...OUT, arrival_date: '2027-05-13' };
    expect(verifyAiFlightLegs([overnight], SECTION.replace('2027', 'XXXX'), ctx)).toHaveLength(1);
  });

  it('drops a leg with an invented time', () => {
    expect(verifyAiFlightLegs([{ ...OUT, departure_time: '11:25' }], SECTION, ctx)).toEqual([]);
    expect(verifyAiFlightLegs([{ ...OUT, arrival_time: '' }], SECTION, ctx)).toEqual([]);
  });

  it('drops a leg with an invented airport code or name', () => {
    expect(verifyAiFlightLegs([{ ...OUT, arrival_airport: 'KIN' }], SECTION, ctx)).toEqual([]);
    expect(verifyAiFlightLegs([{ ...OUT, arrival_airport_name: 'Kingston' }], SECTION, ctx)).toEqual([]);
  });

  it('matches an airport code as a whole word only', () => {
    expect(verifyAiFlightLegs([{ ...OUT, departing_airport: 'MA' }], 'MAN 11:10 MBJ 14:50 Manchester Montego Bay 12 May', ctx)).toEqual([]);
  });

  it('checks the flight number, ignoring case and spaces, and drops an invented one', () => {
    const text = SECTION + '\nBY 123';
    expect(verifyAiFlightLegs([{ ...OUT, flight_number: 'by123' }], text, ctx)).toHaveLength(1);
    expect(verifyAiFlightLegs([{ ...OUT, flight_number: 'BY999' }], text, ctx)).toEqual([]);
  });

  it('drops a leg whose date is neither in the text nor near the deal dates', () => {
    expect(verifyAiFlightLegs([{ ...OUT, departure_date: '2027-08-01', arrival_date: '2027-08-01' }], SECTION, ctx)).toEqual([]);
  });

  it('recognises dates in the usual forms', () => {
    const base = { ...OUT, flight_number: '', departing_airport_name: '', arrival_airport_name: '' };
    const noCtx = {};
    for (const text of ['12/05/2027 MAN 11:10 MBJ 14:50', '12th May MAN 11:10 MBJ 14:50', 'Wed 12 May MAN 11:10 MBJ 14:50', '2027-05-12 MAN 11:10 MBJ 14:50']) {
      expect(verifyAiFlightLegs([base], text, noCtx)).toHaveLength(1);
    }
  });

  it('accepts H:MM and HH.MM spellings of a time', () => {
    const text = 'MAN 9.05 MBJ 14:50 Manchester Montego Bay 12 May';
    expect(verifyAiFlightLegs([{ ...OUT, departure_time: '09:05' }], text, ctx)).toHaveLength(1);
  });

  it('keeps all three legs of a connection and orders outbound before return', () => {
    const text = [
      'Your flights', 'OUT 12 May 2027', '06:00 Manchester MAN', '08:00 Amsterdam AMS', '09:30 Amsterdam AMS', '12:45 Montego Bay MBJ',
      'RTN 26 May 2027', '16:50 Montego Bay MBJ', '07:40 Manchester MAN',
    ].join('\n');
    const leg1: AiFlightLeg = { ...OUT, departure_time: '06:00', arrival_airport: 'AMS', arrival_airport_name: 'Amsterdam', arrival_time: '08:00' };
    const leg2: AiFlightLeg = { ...OUT, departing_airport: 'AMS', departing_airport_name: 'Amsterdam', departure_time: '09:30', arrival_time: '12:45' };
    const out = verifyAiFlightLegs([RTN, leg1, leg2], text, ctx);
    expect(out.map((l) => l.flight_type)).toEqual(['outbound', 'outbound', 'return']);
    expect(out).toHaveLength(3);
  });

  it('falls back to the deal date for a leg with no date, and drops it with no deal date either', () => {
    const undated = { ...OUT, departure_date: '', arrival_date: '' };
    expect(verifyAiFlightLegs([undated], 'MAN 11:10 MBJ 14:50 Manchester Montego Bay', ctx)[0].departure_date_time).toBe('2027-05-12T11:10');
    expect(verifyAiFlightLegs([undated], 'MAN 11:10 MBJ 14:50 Manchester Montego Bay', {})).toEqual([]);
  });
});

describe('helpers', () => {
  it('addDaysIso crosses month ends and rejects junk', () => {
    expect(addDaysIso('2027-05-31', 1)).toBe('2027-06-01');
    expect(addDaysIso('nope', 1)).toBe('');
  });
  it('normaliseClockTime', () => {
    expect(normaliseClockTime('9:40')).toBe('09:40');
    expect(normaliseClockTime('09.40')).toBe('09:40');
    expect(normaliseClockTime('25:00')).toBe('');
  });
});
