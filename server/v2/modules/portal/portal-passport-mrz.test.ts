import { describe, expect, it } from 'vitest';
import { cleanMrzLine, mrzCheckDigit, mrzDate, mrzDigitMatches, parseTd3 } from './portal-passport-mrz';

import { SPECIMEN_LINE_1, SPECIMEN_LINE_2 } from './portal-passport-mrz.fixtures';

const NOW = new Date('2026-11-26T12:00:00Z');

describe('mrzCheckDigit', () => {
  it('matches the known ICAO examples', () => {
    expect(mrzCheckDigit('L898902C3')).toBe(6);
    expect(mrzCheckDigit('740812')).toBe(2);
    expect(mrzCheckDigit('120415')).toBe(9);
    expect(mrzCheckDigit('ZE184226B<<<<<')).toBe(1);
  });

  it('treats the filler as zero and rejects anything outside A-Z, 0-9 and <', () => {
    expect(mrzCheckDigit('<<<<<<')).toBe(0);
    expect(mrzCheckDigit('ab')).toBeNull();
    expect(mrzCheckDigit('12-4')).toBeNull();
  });
});

describe('mrzDigitMatches', () => {
  it('compares a digit, and accepts "<" only for an empty field', () => {
    expect(mrzDigitMatches('740812', '2')).toBe(true);
    expect(mrzDigitMatches('740812', '3')).toBe(false);
    expect(mrzDigitMatches('<<<<<<<<<<<<<<', '<')).toBe(true);
    expect(mrzDigitMatches('AB<<', '<')).toBe(false);
    expect(mrzDigitMatches('740812', 'X')).toBe(false);
  });
});

describe('mrzDate', () => {
  it('puts a birth year later than this year in the last century', () => {
    expect(mrzDate('740812', 'birth', NOW)).toBe('1974-08-12');
    expect(mrzDate('150101', 'birth', NOW)).toBe('2015-01-01');
    expect(mrzDate('270101', 'birth', NOW)).toBe('1927-01-01');
  });

  it('always puts an expiry year in this century', () => {
    expect(mrzDate('120415', 'expiry', NOW)).toBe('2012-04-15');
    expect(mrzDate('350101', 'expiry', NOW)).toBe('2035-01-01');
  });

  it('is null for something that is not a real date', () => {
    expect(mrzDate('741332', 'birth', NOW)).toBeNull();
    expect(mrzDate('7408', 'birth', NOW)).toBeNull();
    expect(mrzDate('740230', 'birth', NOW)).toBeNull();
  });
});

describe('parseTd3', () => {
  it('reads the specimen and verifies every check digit', () => {
    const mrz = parseTd3(SPECIMEN_LINE_1, SPECIMEN_LINE_2, NOW);
    expect(mrz).toMatchObject({
      issuingCountry: 'UTO',
      surname: 'ERIKSSON',
      givenNames: 'ANNA MARIA',
      passportNumber: 'L898902C3',
      nationalityCode: 'UTO',
      dateOfBirth: '1974-08-12',
      sex: 'F',
      expiryDate: '2012-04-15',
      valid: true,
    });
    expect(mrz?.checks).toEqual({ number: true, dateOfBirth: true, expiry: true, personalNumber: true, composite: true });
  });

  it('tolerates spaces and lower case', () => {
    expect(parseTd3(SPECIMEN_LINE_1.toLowerCase(), ` ${SPECIMEN_LINE_2} `, NOW)?.valid).toBe(true);
    expect(cleanMrzLine('p<uto «')).toBe('P<UTO<');
  });

  it('a deliberately wrong document-number check digit fails that check and the composite', () => {
    const wrong = SPECIMEN_LINE_2.slice(0, 9) + '7' + SPECIMEN_LINE_2.slice(10);
    const mrz = parseTd3(SPECIMEN_LINE_1, wrong, NOW);
    expect(mrz?.checks.number).toBe(false);
    expect(mrz?.checks.composite).toBe(false);
    expect(mrz?.checks.dateOfBirth).toBe(true);
    expect(mrz?.valid).toBe(false);
  });

  it('a wrong digit in the date of birth fails only that date and the composite', () => {
    const wrong = SPECIMEN_LINE_2.slice(0, 19) + '5' + SPECIMEN_LINE_2.slice(20);
    const mrz = parseTd3(SPECIMEN_LINE_1, wrong, NOW);
    expect(mrz?.checks).toMatchObject({ number: true, dateOfBirth: false, expiry: true });
    expect(mrz?.valid).toBe(false);
  });

  it('a misread character in the data (not the digit) is caught', () => {
    const misread = SPECIMEN_LINE_2.slice(0, 2) + '0' + SPECIMEN_LINE_2.slice(3);
    expect(parseTd3(SPECIMEN_LINE_1, misread, NOW)?.checks.number).toBe(false);
  });

  it('is null unless both lines are 44 clean characters and line 1 starts with P', () => {
    expect(parseTd3(SPECIMEN_LINE_1.slice(1), SPECIMEN_LINE_2, NOW)).toBeNull();
    expect(parseTd3(SPECIMEN_LINE_1, SPECIMEN_LINE_2 + '<', NOW)).toBeNull();
    expect(parseTd3('I' + SPECIMEN_LINE_1.slice(1), SPECIMEN_LINE_2, NOW)).toBeNull();
    expect(parseTd3(SPECIMEN_LINE_1, SPECIMEN_LINE_2.replace('L', '!'), NOW)).toBeNull();
  });
});
