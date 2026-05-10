import { db } from '../../config/database';
import { auditLog, clientTable, transaction, quote, booking } from '@shared/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

export interface DeletionContext {
  entityId: string;
  entityTitle: string;
  entityData: any;
  reason: string;
  performedBy: string;
  performedByName: string;
  clientId: string | null;
  clientName: string | null;
}

export const auditRepository = {
  async create(entry: any) {
    const [row] = await db.insert(auditLog).values(entry).returning();
    return row;
  },

  async findAll(orgId: string | null) {
    if (!orgId) {
      return db.select().from(auditLog).orderBy(desc(auditLog.createdAt));
    }

    // audit_log.client_id is varchar; client_table.id is uuid → explicit cast.
    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        entityTitle: auditLog.entityTitle,
        entityData: auditLog.entityData,
        reason: auditLog.reason,
        performedBy: auditLog.performedBy,
        performedByName: auditLog.performedByName,
        clientId: auditLog.clientId,
        clientName: auditLog.clientName,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .innerJoin(clientTable, sql`${clientTable.id} = ${auditLog.clientId}::uuid`)
      .where(eq(clientTable.orgId, orgId))
      .orderBy(desc(auditLog.createdAt));
    return rows;
  },

  /**
   * Resolve the orgId + client name for an audited entity (quote/booking),
   * walking transaction → client.
   */
  async resolveEntityClient(transactionId: string | null) {
    if (!transactionId) return { orgId: null as string | null, clientId: null as string | null, clientName: null as string | null };
    const [row] = await db
      .select({
        orgId: clientTable.orgId,
        clientId: clientTable.id,
        title: clientTable.title,
        firstName: clientTable.firstName,
        surename: clientTable.surename,
      })
      .from(transaction)
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(eq(transaction.id, transactionId))
      .limit(1);
    if (!row) return { orgId: null, clientId: null, clientName: null };
    const clientName = [row.title, row.firstName, row.surename].filter(Boolean).join(' ').trim() || null;
    return { orgId: row.orgId, clientId: row.clientId, clientName };
  },

  /** Look up an active (not-soft-deleted) quote by id. */
  async findActiveQuoteById(id: string) {
    const [row] = await db.select().from(quote).where(and(eq(quote.id, id), isNull(quote.deleted_at))).limit(1);
    return row || undefined;
  },

  async findBookingById(id: string) {
    const [row] = await db.select().from(booking).where(eq(booking.id, id)).limit(1);
    return row || undefined;
  },

  /**
   * Atomically write the deletion audit entry and soft-delete the quote.
   * Caller is responsible for resolving the client + scope checks.
   */
  async recordDeletionAndSoftDeleteQuote(ctx: DeletionContext) {
    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: 'delete',
        entityType: 'quote',
        entityId: ctx.entityId,
        entityTitle: ctx.entityTitle,
        entityData: ctx.entityData,
        reason: ctx.reason,
        performedBy: ctx.performedBy,
        performedByName: ctx.performedByName,
        clientId: ctx.clientId,
        clientName: ctx.clientName,
      });
      await tx
        .update(quote)
        .set({ deleted_at: new Date(), deleted_by_v2: ctx.performedBy, is_active: false })
        .where(eq(quote.id, ctx.entityId));
    });
  },

  /** Atomically write the deletion audit entry and hard-delete the booking. */
  async recordDeletionAndDeleteBooking(ctx: DeletionContext) {
    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: 'delete',
        entityType: 'booking',
        entityId: ctx.entityId,
        entityTitle: ctx.entityTitle,
        entityData: ctx.entityData,
        reason: ctx.reason,
        performedBy: ctx.performedBy,
        performedByName: ctx.performedByName,
        clientId: ctx.clientId,
        clientName: ctx.clientName,
      });
      await tx.delete(booking).where(eq(booking.id, ctx.entityId));
    });
  },
};
