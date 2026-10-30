import type { ClientPassengerRow, NeonClient } from '@shared/schema';
import { AppError } from '../../utils/error-handler';
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

/** YYYY-MM-DD plus whole calendar months, clamped to month end (31 Aug + 6 = 28/29 Feb). */
export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

/** True iff the passport expires before six calendar months after the next departure. */
export function computePassportWarning(passportExpiry: string | null, nextDeparture: string | null): boolean {
  if (!passportExpiry || !nextDeparture) return false;
  return passportExpiry < addMonthsYmd(nextDeparture, 6);
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
    passportWarning: computePassportWarning(passportExpiry, nextDeparture),
  };
}

function normalizeCreate(input: CreatePassengerInput): PassengerFields {
  return {
    title: cleanText(input.title),
    firstName: input.firstName.trim(),
    surname: input.surname.trim(),
    dateOfBirth: cleanText(input.dateOfBirth),
    passportNumber: cleanText(input.passportNumber),
    passportExpiry: cleanText(input.passportExpiry),
  };
}

function normalizePatch(input: UpdatePassengerInput): Partial<PassengerFields> {
  const out: Partial<PassengerFields> = {};
  if (input.title !== undefined) out.title = cleanText(input.title);
  if (input.firstName !== undefined) out.firstName = input.firstName.trim();
  if (input.surname !== undefined) out.surname = input.surname.trim();
  if (input.dateOfBirth !== undefined) out.dateOfBirth = cleanText(input.dateOfBirth);
  if (input.passportNumber !== undefined) out.passportNumber = cleanText(input.passportNumber);
  if (input.passportExpiry !== undefined) out.passportExpiry = cleanText(input.passportExpiry);
  return out;
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
    const client = await this.loadClient(clientId, scope);
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

  async setLeadPassport(clientId: string, input: { passportNumber?: string | null; passportExpiry?: string | null }, scope: Scope): Promise<ClientPassenger> {
    const client = await this.loadClientForWrite(clientId, scope);
    const fields: LeadPassportFields = {
      passportNumber: cleanText(input.passportNumber),
      passportExpiry: cleanText(input.passportExpiry),
    };
    const row = await clientPassengerRepository.upsertLead(clientId, fields);
    return leadToApi(client, row, await this.getNextDeparture(clientId));
  },

  async create(clientId: string, input: CreatePassengerInput, scope: Scope): Promise<ClientPassenger> {
    await this.loadClientForWrite(clientId, scope);
    const row = await clientPassengerRepository.create(clientId, normalizeCreate(input));
    return toApi(row, await this.getNextDeparture(clientId));
  },

  async update(clientId: string, passengerId: string, input: UpdatePassengerInput, scope: Scope): Promise<ClientPassenger> {
    await this.loadClientForWrite(clientId, scope);
    const existing = await clientPassengerRepository.findOne(clientId, passengerId);
    if (!existing) throw new AppError('Passenger not found', 404);
    if (existing.isLead) {
      throw new AppError("The lead passenger is edited through the client record and the lead passport endpoint", 400);
    }
    const row = await clientPassengerRepository.update(clientId, passengerId, normalizePatch(input));
    if (!row) throw new AppError('Passenger not found', 404);
    return toApi(row, await this.getNextDeparture(clientId));
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
