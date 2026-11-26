import type { PortalPassenger, PortalPassportCheck, PortalPassportSex } from '@shared/portal-passengers';
import { PORTAL_PASSPORT_SEXES } from '@shared/portal-passengers';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2027-05-04" -> "4 May 2027". */
export function formatLongDate(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** The next trip a passport is measured against: the soonest live booking that has not started. */
export interface PassportTrip {
  bookingId: string;
  destination: string;
  /** YYYY-MM-DD */
  departure: string;
}

/** The details of one stored passenger the customer view needs (the full number stays on the server). */
export interface PassengerSource {
  id: string;
  isLead: boolean;
  firstName: string;
  surname: string;
  dateOfBirth: string | null;
  nationality: string | null;
  sex: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  passportIssueDate: string | null;
}

export function toPortalSex(value: string | null): PortalPassportSex | null {
  return (PORTAL_PASSPORT_SEXES as readonly string[]).includes(value ?? '') ? (value as PortalPassportSex) : null;
}

/** The last four characters of a number, or null when there is none. */
export function lastFour(passportNumber: string | null): string | null {
  const n = (passportNumber ?? '').trim();
  return n ? n.slice(-4) : null;
}

/**
 * The sentence under a passenger. `warns` is the staff side's rule (computePassportWarning: six months or less
 * left at the next departure, or from today when there is no trip), so the two sides cannot disagree.
 */
export function buildPassportCheck(
  passenger: Pick<PassengerSource, 'passportNumber' | 'passportExpiry'>,
  trip: PassportTrip | null,
  warns: boolean,
  agentFirstName: string | null,
  today: string,
): PortalPassportCheck {
  const expiry = passenger.passportExpiry;
  if (!lastFour(passenger.passportNumber) || !expiry) {
    return {
      status: 'missing',
      text: trip ? `Add a passport for your trip to ${trip.destination} on ${formatLongDate(trip.departure)}.` : 'Add a passport so it is ready when you book.',
    };
  }
  const contact = `${agentFirstName?.trim() || 'Your agent'} will be in touch.`;
  if (!warns) {
    return {
      status: 'ok',
      text: trip ? `Valid for your trip to ${trip.destination} on ${formatLongDate(trip.departure)}.` : `Valid until ${formatLongDate(expiry)}.`,
    };
  }
  if (trip) {
    return {
      status: 'warning',
      text:
        expiry < trip.departure
          ? `This passport expires before you travel on ${formatLongDate(trip.departure)}. ${contact}`
          : `This passport has less than 6 months left when you travel on ${formatLongDate(trip.departure)}. ${contact}`,
    };
  }
  return {
    status: 'warning',
    text: expiry < today ? `This passport expired on ${formatLongDate(expiry)}. ${contact}` : `This passport has less than 6 months left (it expires on ${formatLongDate(expiry)}). ${contact}`,
  };
}

/** One passenger as the portal sees it. Built key by key so the full passport number can never leak through a spread. */
export function toPortalPassenger(source: PassengerSource, check: PortalPassportCheck): PortalPassenger {
  return {
    id: source.id,
    isLead: source.isLead,
    firstName: source.firstName,
    surname: source.surname,
    dateOfBirth: source.dateOfBirth,
    nationality: source.nationality,
    sex: toPortalSex(source.sex),
    passportLast4: lastFour(source.passportNumber),
    passportExpiry: source.passportExpiry,
    passportIssueDate: source.passportIssueDate,
    hasPassport: lastFour(source.passportNumber) !== null,
    check,
  };
}
