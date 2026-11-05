import type { ClientPassengerRow, NeonClient } from '@shared/schema';
import { AppError } from '../../utils/error-handler';
import {
  LEAD_IDENTITY_MESSAGE,
  addMonthsYmd,
  firstPassengerError,
  normalisePassportNumber,
  validatePassenger,
  type PassengerRuleInput,
} from '@shared/passenger-rules';
import type { Scope } from '../../utils/scope';
import { toUkWallClock } from '../../utils/uk-time';
import { neonClientService } from '../neon-client/neon-client.service';
import { clientPassengerRepository } from './client-passenger.repository';
import type {
  ClientPassenger,
  ClientPassengersResponse,
  CreatePassengerInput,
  LeadPassportFields,
  PassengerFields,
  UpdatePassengerInput,
} from './client-passenger.types';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Today's calendar date in Europe/London as YYYY-MM-DD. */
export function ukTodayYmd(now: Date = new Date()): string {
  const w = toUkWallClock(now);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

export { addMonthsYmd };

/**
 * True iff the passport has six calendar months or less left (expired and exactly-6-months included),
 * measured from the next departure, or from today when there is none.
 */
export function computePassportWarning(passportExpiry: string | null, nextDeparture: string | null, today: string = ukTodayYmd()): boolean {
  if (!passportExpiry) return false;
  return passportExpiry <= addMonthsYmd(nextDeparture ?? today, 6);
}

/** Trim; empty or whitespace-only becomes null. */
function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const t = value.trim();
  return t === '' ? null : t;
}

function toApi(row: ClientPassengerRow, nextDeparture: string | null): ClientPassenger {
  return {
    id: row.id,
    isLead: false,
    title: row.title,
    firstName: row.firstName,
    surname: row.surname,
    dateOfBirth: row.dateOfBirth,
    passportNumber: row.passportNumber,
    passportExpiry: row.passportExpiry,
    passportNonUk: row.passportNonUk,
    passportWarning: computePassportWarning(row.passportExpiry, nextDeparture),
  };
}

/** The lead's identity always comes from the client record; only passport fields come from the lead row. */
function leadToApi(client: NeonClient, row: ClientPassengerRow | null, nextDeparture: string | null): ClientPassenger {
  const passportExpiry = row?.passportExpiry ?? null;
  return {
    id: row?.id ?? null,
    isLead: true,
    title: client.title ?? null,
    firstName: client.firstName,
    surname: client.surename,
    dateOfBirth: client.DOB ?? null,
    passportNumber: row?.passportNumber ?? null,
    passportExpiry,
    passportNonUk: row?.passportNonUk ?? false,
    passportWarning: computePassportWarning(passportExpiry, nextDeparture),
  };
}

/** Trim everything; the passport number is upper-cased when Non-UK. Empty becomes null. */
function normalizeFields(input: CreatePassengerInput): PassengerFields {
  const passportNonUk = !!input.passportNonUk;
  return {
    title: cleanText(input.title),
    firstName: (input.firstName ?? '').trim(),
    surname: (input.surname ?? '').trim(),
    dateOfBirth: cleanText(input.dateOfBirth),
    passportNumber: cleanText(normalisePassportNumber(input.passportNumber, passportNonUk)),
    passportExpiry: cleanText(input.passportExpiry),
    passportNonUk,
  };
}

/** Enforce the shared passenger rules; the 400 message names the first failing field. */
function assertPassengerRules(fields: PassengerRuleInput, nextDeparture: string | null): void {
  const message = firstPassengerError(validatePassenger(fields, { nextDeparture, today: ukTodayYmd() }));
  if (message) throw new AppError(message, 400);
}

/** Drop undefined keys so a spread patch never overwrites stored values with undefined. */
function definedOnly(input: UpdatePassengerInput): UpdatePassengerInput {
  return Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as UpdatePassengerInput;
}

export const clientPassengerService = {
  /** Fail-closed gate: the same org/branch scope as GET /neon-clients/:id (404 when not visible). */
  async loadClient(clientId: string, scope: Scope): Promise<NeonClient> {
    return neonClientService.getNeonClientById(clientId, scope);
  },

  /** Writes are refused on a client that was merged into another one (reads stay allowed). */
  async loadClientForWrite(clientId: string, scope: Scope): Promise<NeonClient> {
    const client = await this.loadClient(clientId, scope);
    if (client.status === 'merged') throw new AppError('This client was merged into another client', 400);
    return client;
  },

  async getNextDeparture(clientId: string): Promise<string | null> {
    return clientPassengerRepository.findNextDepartureDate(clientId, ukTodayYmd());
  },

  async list(clientId: string, scope: Scope): Promise<ClientPassengersResponse> {
    // Reading is allowed for admins on a soft-deleted client (read-only page); writes stay 404.
    const client = await neonClientService.viewNeonClientById(clientId, scope);
    const [rows, nextDeparture] = await Promise.all([
      clientPassengerRepository.findByClient(clientId),
      this.getNextDeparture(clientId),
    ]);
    const leadRow = rows.find((r) => r.isLead) ?? null;
    const others = rows.filter((r) => !r.isLead);
    return {
      passengers: [leadToApi(client, leadRow, nextDeparture), ...others.map((r) => toApi(r, nextDeparture))],
      nextDeparture,
    };
  },

  async setLeadPassport(clientId: string, input: { passportNumber?: string | null; passportExpiry?: string | null; passportNonUk?: boolean }, scope: Scope): Promise<ClientPassenger> {
    const client = await this.loadClientForWrite(clientId, scope);
    const passportNonUk = !!input.passportNonUk;
    const fields: LeadPassportFields = {
      passportNumber: cleanText(normalisePassportNumber(input.passportNumber, passportNonUk)),
      passportExpiry: cleanText(input.passportExpiry),
      passportNonUk,
    };
    const nextDeparture = await this.getNextDeparture(clientId);
    // The lead's title, name and date of birth come from the client record but are mandatory too.
    const errors = validatePassenger(
      { title: client.title, firstName: client.firstName, surname: client.surename, dateOfBirth: client.DOB, ...fields },
      { nextDeparture, today: ukTodayYmd(), isLead: true },
    );
    if (errors.title || errors.dateOfBirth || errors.firstName || errors.surname) throw new AppError(LEAD_IDENTITY_MESSAGE, 400);
    const message = firstPassengerError(errors);
    if (message) throw new AppError(message, 400);
    const row = await clientPassengerRepository.upsertLead(clientId, fields);
    return leadToApi(client, row, nextDeparture);
  },

  async create(clientId: string, input: CreatePassengerInput, scope: Scope): Promise<ClientPassenger> {
    await this.loadClientForWrite(clientId, scope);
    const nextDeparture = await this.getNextDeparture(clientId);
    const fields = normalizeFields(input);
    assertPassengerRules(fields, nextDeparture);
    const row = await clientPassengerRepository.create(clientId, fields);
    return toApi(row, nextDeparture);
  },

  async update(clientId: string, passengerId: string, input: UpdatePassengerInput, scope: Scope): Promise<ClientPassenger> {
    await this.loadClientForWrite(clientId, scope);
    const existing = await clientPassengerRepository.findOne(clientId, passengerId);
    if (!existing) throw new AppError('Passenger not found', 404);
    if (existing.isLead) {
      throw new AppError("The lead passenger is edited through the client record and the lead passport endpoint", 400);
    }
    // Validate the merged passenger (stored + patch): an old record with gaps must be completed to be saved.
    const merged = normalizeFields({
      title: existing.title,
      firstName: existing.firstName,
      surname: existing.surname,
      dateOfBirth: existing.dateOfBirth,
      passportNumber: existing.passportNumber,
      passportExpiry: existing.passportExpiry,
      passportNonUk: existing.passportNonUk,
      ...definedOnly(input),
    });
    const nextDeparture = await this.getNextDeparture(clientId);
    assertPassengerRules(merged, nextDeparture);
    const row = await clientPassengerRepository.update(clientId, passengerId, merged);
    if (!row) throw new AppError('Passenger not found', 404);
    return toApi(row, nextDeparture);
  },

  async remove(clientId: string, passengerId: string, scope: Scope): Promise<void> {
    await this.loadClientForWrite(clientId, scope);
    const existing = await clientPassengerRepository.findOne(clientId, passengerId);
    if (!existing) throw new AppError('Passenger not found', 404);
    if (existing.isLead) throw new AppError('The lead passenger cannot be deleted', 400);
    const removed = await clientPassengerRepository.remove(clientId, passengerId);
    if (!removed) throw new AppError('Passenger not found', 404);
  },
};
