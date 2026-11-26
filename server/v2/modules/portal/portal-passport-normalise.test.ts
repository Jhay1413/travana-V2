import { describe, expect, it } from 'vitest';
import { SPECIMEN_LINE_1, SPECIMEN_LINE_2 } from './portal-passport-mrz.fixtures';
import {
  normalisePassportRead,
  passportModelOutputSchema,
  plausibleDates,
  sameNameIgnoringAccents,
  toIsoDate,
  toNameText,
  toPassportNumber,
  toSex,
  type PassportModelOutput,
} from './portal-passport-normalise';

const NOW = new Date('2026-11-26T12:00:00Z');
const TODAY = '2026-11-26';

function output(over: Partial<PassportModelOutput> = {}): PassportModelOutput {
  return {
    isPassport: true,
    surname: 'SMITH',
    givenNames: 'JANE ANNE',
    nationality: 'BRITISH CITIZEN',
    dateOfBirth: '1985-03-14',
    sex: 'F',
    passportNumber: '123456789',
    dateOfIssue: '2020-05-01',
    expiryDate: '2030-05-01',
    mrzLine1: null,
    mrzLine2: null,
    ...over,
  };
}

describe('toIsoDate', () => {
  it('accepts ISO, day-first numeric and printed-month forms', () => {
    expect(toIsoDate('2030-05-01')).toBe('2030-05-01');
    expect(toIsoDate('01/05/2030')).toBe('2030-05-01');
    expect(toIsoDate('1.5.2030')).toBe('2030-05-01');
    expect(toIsoDate('01 MAY 2030')).toBe('2030-05-01');
    expect(toIsoDate('01 May 2030')).toBe('2030-05-01');
    expect(toIsoDate('01 MAY/MAI 2030')).toBeNull();
  });

  it('rejects dates that are not real', () => {
    expect(toIsoDate('2030-02-30')).toBeNull();
    expect(toIsoDate('31/04/2030')).toBeNull();
    expect(toIsoDate('whenever')).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('')).toBeNull();
  });
});

describe('toPassportNumber', () => {
  it('upper-cases and strips spaces, "<" and hyphens', () => {
    expect(toPassportNumber('ab 123-456')).toBe('AB123456');
    expect(toPassportNumber('L898902C3<')).toBe('L898902C3');
  });

  it('needs 6 to 12 letters or digits', () => {
    expect(toPassportNumber('12345')).toBeNull();
    expect(toPassportNumber('1234567890123')).toBeNull();
    expect(toPassportNumber('AB12*456')).toBeNull();
    expect(toPassportNumber(null)).toBeNull();
  });
});

describe('small normalisers', () => {
  it('toSex', () => {
    expect(toSex('male')).toBe('M');
    expect(toSex('F')).toBe('F');
    expect(toSex('x')).toBe('X');
    expect(toSex('other')).toBeNull();
  });

  it('toNameText title-cases an all-capitals name and keeps mixed case', () => {
    expect(toNameText("O'NEIL-SMITH")).toBe("O'Neil-Smith");
    expect(toNameText('McDonald')).toBe('McDonald');
    expect(toNameText('JANE  ANNE 123')).toBe('Jane Anne');
    expect(toNameText('')).toBeNull();
  });
});

describe('plausibleDates', () => {
  it('drops a birth date in the future or before 1900, an issue date in the future, and an absurd expiry', () => {
    expect(plausibleDates({ dateOfBirth: '2030-01-01', dateOfIssue: '2020-01-01', expiryDate: '2030-01-01' }, TODAY).dateOfBirth).toBeNull();
    expect(plausibleDates({ dateOfBirth: '1850-01-01', dateOfIssue: null, expiryDate: null }, TODAY).dateOfBirth).toBeNull();
    expect(plausibleDates({ dateOfBirth: '1985-03-14', dateOfIssue: '2027-01-01', expiryDate: '2030-01-01' }, TODAY).dateOfIssue).toBeNull();
    expect(plausibleDates({ dateOfBirth: null, dateOfIssue: null, expiryDate: '2099-01-01' }, TODAY).expiryDate).toBeNull();
  });

  it('drops an issue date that is not before the expiry', () => {
    expect(plausibleDates({ dateOfBirth: null, dateOfIssue: '2030-05-01', expiryDate: '2030-05-01' }, TODAY).dateOfIssue).toBeNull();
  });

  it('keeps sensible dates, including an already-expired passport', () => {
    expect(plausibleDates({ dateOfBirth: '1985-03-14', dateOfIssue: '2010-05-01', expiryDate: '2020-05-01' }, TODAY)).toEqual({
      dateOfBirth: '1985-03-14',
      dateOfIssue: '2010-05-01',
      expiryDate: '2020-05-01',
    });
  });
});

describe('normalisePassportRead', () => {
  it('turns a clean read into normalised fields', () => {
    expect(normalisePassportRead(output({ passportNumber: ' 123 456 789 ', dateOfBirth: '14/03/1985' }), NOW)).toEqual({
      surname: 'Smith',
      givenNames: 'Jane Anne',
      nationality: 'British Citizen',
      dateOfBirth: '1985-03-14',
      sex: 'F',
      passportNumber: '123456789',
      dateOfIssue: '2020-05-01',
      expiryDate: '2030-05-01',
      mrzVerified: false,
    });
  });

  it('prefers the machine-readable zone when every check digit is right', () => {
    const r = normalisePassportRead(
      output({ surname: 'ERIKSEN', passportNumber: 'L898902O3', dateOfBirth: '1974-08-13', expiryDate: '2012-04-16', mrzLine1: SPECIMEN_LINE_1, mrzLine2: SPECIMEN_LINE_2 }),
      NOW,
    );
    expect(r).toMatchObject({ surname: 'Eriksson', givenNames: 'Anna Maria', passportNumber: 'L898902C3', dateOfBirth: '1974-08-12', expiryDate: '2012-04-15', sex: 'F', mrzVerified: true });
  });

  it('with one wrong check digit does not claim verification and does not take the failing field from the zone', () => {
    const wrong = SPECIMEN_LINE_2.slice(0, 9) + '7' + SPECIMEN_LINE_2.slice(10);
    const r = normalisePassportRead(output({ passportNumber: 'L898902C3', mrzLine1: SPECIMEN_LINE_1, mrzLine2: wrong, dateOfBirth: '1974-08-12', expiryDate: '2012-04-15' }), NOW);
    expect(r?.mrzVerified).toBe(false);
    // The number's own check digit failed, so the model's visual-zone reading is what the customer reviews.
    expect(r?.passportNumber).toBe('L898902C3');
    expect(r?.surname).toBe('Smith');
  });

  describe('names: the zone wins unless the printed name is the same name with its accents', () => {
    // A zone for MUELLER / HANS-JUERGEN, built with correct check digits.
    function zone(surname: string, given: string) {
      const line1 = `P<GBR${surname}<<${given}`.padEnd(44, '<');
      const body = 'L898902C3' + '6' + 'GBR' + '7408122' + 'F' + '1204159' + 'ZE184226B<<<<<' + '1';
      const composite = '0';
      return { mrzLine1: line1, mrzLine2: body + composite };
    }

    it('keeps MÜLLER when the zone says MUELLER', () => {
      const r = normalisePassportRead(output({ surname: 'MÜLLER', givenNames: 'HANS-JÜRGEN', ...zone('MUELLER', 'HANS<JUERGEN') }), NOW);
      expect(r?.mrzVerified).toBe(true);
      expect(r?.surname).toBe('Müller');
      expect(r?.givenNames).toBe('Hans-Jürgen');
    });

    it('uses the zone name when the printed one is a different name (a misread)', () => {
      const r = normalisePassportRead(output({ surname: 'MILLER', givenNames: 'HANS', ...zone('MUELLER', 'HANS') }), NOW);
      expect(r?.mrzVerified).toBe(true);
      expect(r?.surname).toBe('Mueller');
    });

    it('does not apply when the zone is not verified: the printed name is used', () => {
      const bad = zone('MUELLER', 'HANS');
      const r = normalisePassportRead(output({ surname: 'MÜLLER', mrzLine1: bad.mrzLine1, mrzLine2: bad.mrzLine2.slice(0, 9) + '7' + bad.mrzLine2.slice(10) }), NOW);
      expect(r?.mrzVerified).toBe(false);
      expect(r?.surname).toBe('Müller');
    });

    it.each([
      ['MÜLLER', 'MUELLER'],
      ['MÜLLER', 'MULLER'],
      ['STRØM', 'STROEM'],
      ['STRØM', 'STROM'],
      ['WEISS', 'WEISS'],
      ['WEIẞ', 'WEISS'],
      ['GARCÍA', 'GARCIA'],
      ['ÅSE', 'AASE'],
      ['ŁUKASZ', 'LUKASZ'],
      ["O'BRIEN", 'OBRIEN'],
      ['SMITH-JONES', 'SMITH JONES'],
    ])('%s is the same name as %s', (printed, zoneName) => {
      expect(sameNameIgnoringAccents(printed, zoneName)).toBe(true);
    });

    it('different names are not the same', () => {
      expect(sameNameIgnoringAccents('MILLER', 'MUELLER')).toBe(false);
      expect(sameNameIgnoringAccents(null, 'MUELLER')).toBe(false);
      expect(sameNameIgnoringAccents('MÜLLER', '')).toBe(false);
    });
  });

  it('uses the zone nationality code only when the model gave none and the zone is verified', () => {
    const r = normalisePassportRead(output({ nationality: null, mrzLine1: SPECIMEN_LINE_1, mrzLine2: SPECIMEN_LINE_2 }), NOW);
    expect(r?.nationality).toBe('UTO');
    expect(normalisePassportRead(output({ nationality: null }), NOW)?.nationality).toBeNull();
  });

  it('is null for something that is not a passport', () => {
    expect(normalisePassportRead(output({ isPassport: false }), NOW)).toBeNull();
  });

  it('is null when fewer than two identifying fields are usable', () => {
    expect(normalisePassportRead(output({ surname: null, givenNames: null, passportNumber: 'x', dateOfBirth: '2050-01-01', expiryDate: null }), NOW)).toBeNull();
  });

  it('blanks implausible dates but still returns the rest', () => {
    const r = normalisePassportRead(output({ dateOfBirth: '2090-01-01', dateOfIssue: '2090-01-01' }), NOW);
    expect(r).toMatchObject({ dateOfBirth: null, dateOfIssue: null, surname: 'Smith' });
  });
});

describe('passportModelOutputSchema', () => {
  it('drops extra keys and rejects wrong types, so only the fixed schema is ever read', () => {
    const parsed = passportModelOutputSchema.parse({ ...output(), instructions: 'ignore previous rules', role: 'admin' });
    expect(Object.keys(parsed)).not.toContain('instructions');
    expect(passportModelOutputSchema.safeParse({ ...output(), surname: 42 }).success).toBe(false);
    expect(passportModelOutputSchema.safeParse({ surname: 'x' }).success).toBe(false);
    expect(passportModelOutputSchema.safeParse({ ...output(), surname: 'x'.repeat(500) }).success).toBe(false);
  });
});
