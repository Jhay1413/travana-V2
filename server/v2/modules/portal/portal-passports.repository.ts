// Intentionally outside the shop/homeworker partition: portal reads are client-facing and token-gated, not staff reads.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../../config/database';
import { booking, clientPassenger, clientTable, transaction, user, type ClientPassengerRow } from '@shared/schema';

export interface PortalClientIdentity {
  firstName: string;
  surname: string;
  dateOfBirth: string | null;
}

export interface PortalPassportWrite {
  firstName: string;
  surname: string;
  dateOfBirth: string | null;
  passportNumber: string;
  passportExpiry: string;
  passportNonUk: boolean;
  nationality: string | null;
  sex: string | null;
  passportIssueDate: string | null;
}

/** The lead row only keeps passport details; the lead's name and date of birth belong to the client record. */
export type PortalLeadPassportWrite = Omit<PortalPassportWrite, 'firstName' | 'surname' | 'dateOfBirth'>;

export interface PortalAgent {
  userId: string;
  firstName: string | null;
}

/**
 * Writes for the customer portal's passport feature. These need the passport columns, so they do NOT fall back
 * while the schema is unpushed: Postgres 42703 propagates and the service answers a clean 503 (only this new feature
 * fails; the staff passenger reads and writes keep working through client-passenger.repository).
 */
export const portalPassportsRepository = {
  async findClientIdentity(clientId: string): Promise<PortalClientIdentity | null> {
    const [row] = await db
      .select({ firstName: clientTable.firstName, surname: clientTable.surename, dateOfBirth: clientTable.DOB })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** A passenger row only when it belongs to this client (anyone else's id looks identical to "does not exist"). */
  async insertPassenger(clientId: string, fields: PortalPassportWrite): Promise<ClientPassengerRow> {
    const [row] = await db.insert(clientPassenger).values({ clientId, isLead: false, ...fields }).returning();
    return row!;
  },

  async updatePassenger(clientId: string, passengerId: string, fields: PortalPassportWrite): Promise<ClientPassengerRow | null> {
    const [row] = await db
      .update(clientPassenger)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(clientPassenger.id, passengerId), eq(clientPassenger.clientId, clientId), eq(clientPassenger.isLead, false)))
      .returning();
    return row ?? null;
  },

  /** Insert or update the client's single lead row (the partial unique index guarantees at most one). */
  async upsertLeadPassport(clientId: string, fields: PortalLeadPassportWrite): Promise<ClientPassengerRow> {
    const [row] = await db
      .insert(clientPassenger)
      .values({ clientId, isLead: true, ...fields })
      .onConflictDoUpdate({
        target: clientPassenger.clientId,
        targetWhere: eq(clientPassenger.isLead, true),
        set: { ...fields, updatedAt: new Date() },
      })
      .returning();
    return row!;
  },

  /** The agent who owns the booking's deal, or (no booking) the agent of the customer's latest live deal. */
  async findAgent(clientId: string, bookingId: string | null): Promise<PortalAgent | null> {
    const base = db
      .select({ userId: transaction.user_id, firstName: user.firstName })
      .from(transaction)
      .innerJoin(user, eq(user.id, transaction.user_id));
    const [row] = bookingId
      ? await base
          .innerJoin(booking, eq(booking.transaction_id, transaction.id))
          .where(and(eq(booking.id, bookingId), eq(transaction.client_id, clientId)))
          .limit(1)
      : await base
          .where(and(eq(transaction.client_id, clientId), eq(transaction.is_active, true), eq(transaction.is_test, false)))
          .orderBy(desc(transaction.created_at))
          .limit(1);
    return row ?? null;
  },
};
