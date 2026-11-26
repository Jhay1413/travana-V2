import type { PortalPassenger } from '@shared/portal-passengers';
import { PORTAL_LEAD_PASSENGER_ID } from '@shared/portal-passengers';
import { AppError } from '../../utils/error-handler';
import { clientPassengerRepository } from '../client-passenger/client-passenger.repository';
import { computePassportWarning } from '../client-passenger/client-passenger.service';
import { isUndefinedColumn } from '../client-passenger/client-passenger-legacy.schema';
import { notificationRepository } from '../notification/notification.repository';
import { portalBookingsService } from './portal-bookings.service';
import { buildPassportCheck, toPortalPassenger, type PassengerSource, type PassportTrip } from './portal-passports.mapper';
import { portalPassportsRepository } from './portal-passports.repository';
import type { PortalPassportBody } from './portal-passports.validator';
import { pickNextBooking, toIsoDay, ukDay, unfinishedBookings } from './portal-summary.mapper';

export const PASSPORTS_UNAVAILABLE = "We can't save passport details just yet. Please try again later.";
const NOT_FOUND = 'Passenger not found';

/** Empty string or null = not given. */
function blankToNull(value: string | null | undefined): string | null {
  const t = (value ?? '').trim();
  return t === '' ? null : t;
}

/** The only place the customer's number is normalised: letters and digits, upper-cased. */
export function normaliseNumber(value: string): string {
  return value.trim().toUpperCase();
}

/** A number that is not exactly nine digits is a non-UK style number for the staff side's rules. */
export function isNonUkNumber(passportNumber: string): boolean {
  return !/^\d{9}$/.test(passportNumber);
}

function toFields(input: PortalPassportBody) {
  const passportNumber = normaliseNumber(input.passportNumber);
  return {
    firstName: input.firstName.trim(),
    surname: input.surname.trim(),
    dateOfBirth: input.dateOfBirth,
    passportNumber,
    passportExpiry: input.passportExpiry,
    passportNonUk: isNonUkNumber(passportNumber),
    nationality: blankToNull(input.nationality),
    sex: blankToNull(input.sex),
    passportIssueDate: blankToNull(input.passportIssueDate),
  };
}

export const portalPassportsService = {
  /** The soonest live booking that has not started: the same booking rule Home uses for "next holiday". */
  async findNextTrip(clientId: string, now: Date = new Date()): Promise<PassportTrip | null> {
    const bookings = await portalBookingsService.listBookings(clientId, now);
    const next = pickNextBooking(unfinishedBookings(bookings, now));
    if (!next) return null;
    return { bookingId: next.booking.id, destination: next.booking.destination, departure: toIsoDay(next.booking.travel_date) };
  },

  /**
   * Everyone saved for the signed-in customer, the customer (lead) first. A customer with no lead row yet still
   * gets a lead entry (id "lead") built from their own record, so "Add passport" always has a target.
   */
  async list(clientId: string, now: Date = new Date()): Promise<PortalPassenger[]> {
    const [identity, rows, trip] = await Promise.all([
      portalPassportsRepository.findClientIdentity(clientId),
      clientPassengerRepository.findByClient(clientId),
      this.findNextTrip(clientId, now),
    ]);
    if (!identity) throw new AppError(NOT_FOUND, 404);

    const leadRow = rows.find((r) => r.isLead) ?? null;
    const sources: PassengerSource[] = [
      {
        id: leadRow?.id ?? PORTAL_LEAD_PASSENGER_ID,
        isLead: true,
        firstName: identity.firstName,
        surname: identity.surname,
        dateOfBirth: identity.dateOfBirth,
        nationality: leadRow?.nationality ?? null,
        sex: leadRow?.sex ?? null,
        passportNumber: leadRow?.passportNumber ?? null,
        passportExpiry: leadRow?.passportExpiry ?? null,
        passportIssueDate: leadRow?.passportIssueDate ?? null,
      },
      ...rows
        .filter((r) => !r.isLead)
        .map((r) => ({
          id: r.id,
          isLead: false,
          firstName: r.firstName,
          surname: r.surname,
          dateOfBirth: r.dateOfBirth,
          nationality: r.nationality ?? null,
          sex: r.sex ?? null,
          passportNumber: r.passportNumber,
          passportExpiry: r.passportExpiry,
          passportIssueDate: r.passportIssueDate ?? null,
        })),
    ];

    const today = ukDay(now);
    const warns = (s: PassengerSource): boolean => s.passportExpiry !== null && computePassportWarning(s.passportExpiry, trip?.departure ?? null, today);
    // The agent's name is only needed for the "will be in touch" sentence.
    const agent = sources.some(warns) && sources.some((s) => s.passportNumber) ? await portalPassportsRepository.findAgent(clientId, trip?.bookingId ?? null) : null;
    return sources.map((s) => toPortalPassenger(s, buildPassportCheck(s, trip, warns(s), agent?.firstName ?? null, today)));
  },

  /**
   * Saves the details the customer confirmed on an existing passenger of theirs ("lead" or a passenger id). Another
   * customer's passenger id answers the same 404 as one that does not exist. The lead's name and date of birth stay
   * on the client record; only passport details are written for the lead.
   */
  async savePassport(clientId: string, passengerId: string, input: PortalPassportBody): Promise<PortalPassenger> {
    const fields = toFields(input);
    const { firstName, surname, dateOfBirth, ...passportOnly } = fields;
    try {
      let savedId: string;
      if (passengerId === PORTAL_LEAD_PASSENGER_ID) {
        savedId = (await portalPassportsRepository.upsertLeadPassport(clientId, passportOnly)).id;
      } else {
        const existing = await clientPassengerRepository.findOne(clientId, passengerId);
        if (!existing) throw new AppError(NOT_FOUND, 404);
        if (existing.isLead) {
          savedId = (await portalPassportsRepository.upsertLeadPassport(clientId, passportOnly)).id;
        } else {
          const row = await portalPassportsRepository.updatePassenger(clientId, passengerId, fields);
          if (!row) throw new AppError(NOT_FOUND, 404);
          savedId = row.id;
        }
      }
      return await this.afterSave(clientId, savedId, `${firstName} ${surname}`.trim());
    } catch (err) {
      if (isUndefinedColumn(err)) throw new AppError(PASSPORTS_UNAVAILABLE, 503, true, 'PASSPORTS_UNAVAILABLE');
      throw err;
    }
  },

  /** A new (non-lead) passenger for the signed-in customer. The customer themself is the lead and already listed. */
  async createPassenger(clientId: string, input: PortalPassportBody): Promise<PortalPassenger> {
    const fields = toFields(input);
    try {
      const row = await portalPassportsRepository.insertPassenger(clientId, fields);
      return await this.afterSave(clientId, row.id, `${fields.firstName} ${fields.surname}`.trim());
    } catch (err) {
      if (isUndefinedColumn(err)) throw new AppError(PASSPORTS_UNAVAILABLE, 503, true, 'PASSPORTS_UNAVAILABLE');
      throw err;
    }
  },

  /** Tells the agent (best effort, no passport number in the text) and returns the saved passenger in the portal shape. */
  async afterSave(clientId: string, savedId: string, passengerName: string): Promise<PortalPassenger> {
    const list = await this.list(clientId);
    const saved = list.find((p) => p.id === savedId) ?? list.find((p) => p.isLead && p.hasPassport);
    if (!saved) throw new AppError(NOT_FOUND, 404);
    await this.notifyAgent(clientId, passengerName);
    return saved;
  },

  /**
   * Staff learn of a change through the agent's notification bell (the client page has no activity feed that takes
   * system entries). Never fails the save.
   */
  async notifyAgent(clientId: string, passengerName: string): Promise<void> {
    try {
      const trip = await this.findNextTrip(clientId);
      const agent = await portalPassportsRepository.findAgent(clientId, trip?.bookingId ?? null);
      if (!agent) return;
      await notificationRepository.create({
        userId: agent.userId,
        type: 'portal_passport_updated',
        title: 'Passport details updated',
        message: `${passengerName || 'A customer'} had passport details saved in the customer portal. Check them on the client page.`,
        link: `/clients/${clientId}`,
        read: false,
      });
    } catch (err) {
      console.warn('[portal-passports] agent notification failed:', err instanceof Error ? err.name : 'error');
    }
  },
};
