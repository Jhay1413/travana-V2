import { describe, expect, it } from 'vitest';
import { portalCreatePassengerValidator, portalSavePassportValidator } from './portal-passports.validator';

const GOOD = {
  firstName: 'Jane Anne',
  surname: "O'Neil-Smith",
  dateOfBirth: '1985-03-14',
  nationality: 'British Citizen',
  sex: 'F',
  passportNumber: 'ab1234567',
  passportIssueDate: '2020-05-01',
  passportExpiry: '2030-05-01',
};
const ID = '3f6c9a52-1d2b-4e8f-9a41-0b7c5d6e8f10';

function failure(body: Record<string, unknown>, params: Record<string, unknown> = { id: ID }): string | null {
  const r = portalSavePassportValidator.safeParse({ params, body });
  return r.success ? null : (r.error.errors[0]?.message ?? null);
}

describe('portalSavePassportValidator', () => {
  it('accepts a complete body for a passenger id or for "lead"', () => {
    expect(failure(GOOD)).toBeNull();
    expect(failure(GOOD, { id: 'lead' })).toBeNull();
  });

  it('accepts a body without the optional details (or with them blank / null)', () => {
    const { nationality, sex, passportIssueDate, ...required } = GOOD;
    void nationality; void sex; void passportIssueDate;
    expect(failure(required)).toBeNull();
    expect(failure({ ...GOOD, nationality: '', sex: '', passportIssueDate: '' })).toBeNull();
    expect(failure({ ...GOOD, nationality: null, sex: null, passportIssueDate: null })).toBeNull();
  });

  it('rejects an id that is neither a uuid nor "lead"', () => {
    expect(failure(GOOD, { id: '1; drop table' })).toBe('Passenger not found');
  });

  it('names: required, bounded, letters only', () => {
    expect(failure({ ...GOOD, firstName: '  ' })).toBe('Given names is required');
    expect(failure({ ...GOOD, surname: '' })).toBe('Surname is required');
    expect(failure({ ...GOOD, surname: 'x'.repeat(101) })).toBe('Surname is too long');
    expect(failure({ ...GOOD, firstName: 'x'.repeat(151) })).toBe('Given names is too long');
    expect(failure({ ...GOOD, surname: 'Smith<script>' })).toBe('Surname can only contain letters, spaces, hyphens and apostrophes');
    expect(failure({ ...GOOD, firstName: undefined })).toBe('Given names is required');
  });

  it('date of birth: a real date in the past', () => {
    expect(failure({ ...GOOD, dateOfBirth: '1985-02-30' })).toBe('Date of birth must be a real date');
    expect(failure({ ...GOOD, dateOfBirth: '14/03/1985' })).toBe('Date of birth must be a real date');
    expect(failure({ ...GOOD, dateOfBirth: '2999-01-01' })).toBe('Date of birth must be in the past');
    expect(failure({ ...GOOD, dateOfBirth: '1800-01-01' })).toBe('Date of birth must be in the past');
    expect(failure({ ...GOOD, dateOfBirth: undefined })).toBe('Date of birth is required');
  });

  it('passport number: 6 to 12 letters or digits', () => {
    expect(failure({ ...GOOD, passportNumber: '12345' })).toBe('Passport number must be 6 to 12 letters or digits');
    expect(failure({ ...GOOD, passportNumber: '1234567890123' })).toBe('Passport number must be 6 to 12 letters or digits');
    expect(failure({ ...GOOD, passportNumber: 'AB 12345' })).toBe('Passport number must be 6 to 12 letters or digits');
    expect(failure({ ...GOOD, passportNumber: 'AB-12345' })).toBe('Passport number must be 6 to 12 letters or digits');
    expect(failure({ ...GOOD, passportNumber: undefined })).toBe('Passport number is required');
    expect(failure({ ...GOOD, passportNumber: '123456' })).toBeNull();
    expect(failure({ ...GOOD, passportNumber: '123456789012' })).toBeNull();
  });

  it('sex: M, F or X only', () => {
    expect(failure({ ...GOOD, sex: 'Z' })).toBe('Choose M, F or X');
    expect(failure({ ...GOOD, sex: 'female' })).toBe('Choose M, F or X');
    expect(failure({ ...GOOD, sex: 'X' })).toBeNull();
  });

  it('nationality: bounded letters', () => {
    expect(failure({ ...GOOD, nationality: 'x'.repeat(101) })).toBe('Nationality is too long');
    expect(failure({ ...GOOD, nationality: 'B1itish' })).toBe('Nationality can only contain letters');
  });

  it('issue date: a real date, not in the future', () => {
    expect(failure({ ...GOOD, passportIssueDate: '2020-13-01' })).toBe('Date of issue must be a real date');
    expect(failure({ ...GOOD, passportIssueDate: '2999-01-01' })).toBe('Date of issue must not be in the future');
  });

  it('expiry: a real date, after the issue date, and not absurdly far away', () => {
    expect(failure({ ...GOOD, passportExpiry: '2030-02-31' })).toBe('Expiry date must be a real date');
    expect(failure({ ...GOOD, passportExpiry: '2020-05-01' })).toBe('Expiry date must be after the date of issue');
    expect(failure({ ...GOOD, passportExpiry: '2019-05-01' })).toBe('Expiry date must be after the date of issue');
    expect(failure({ ...GOOD, passportExpiry: '2999-01-01' })).toBe('Expiry date does not look right');
    expect(failure({ ...GOOD, passportExpiry: undefined })).toBe('Expiry date is required');
  });

  it('an already-expired passport can still be saved (the check wording tells the customer)', () => {
    expect(failure({ ...GOOD, passportIssueDate: '2010-05-01', passportExpiry: '2020-05-01' })).toBeNull();
  });
});

describe('portalCreatePassengerValidator', () => {
  it('uses the same body rules and has no id param', () => {
    expect(portalCreatePassengerValidator.safeParse({ body: GOOD }).success).toBe(true);
    expect(portalCreatePassengerValidator.safeParse({ body: { ...GOOD, passportNumber: '1' } }).success).toBe(false);
  });
});
