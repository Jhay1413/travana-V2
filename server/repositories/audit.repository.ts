import { db } from "../config/database";
import {
  auditLog, quote, booking, transaction, clientTable, user as userTable,
  type AuditLog, type InsertAuditLog, type User,
} from "@shared/schema";
import { desc, eq, and, isNull } from "drizzle-orm";

export const auditRepository = {
  async create(entry: InsertAuditLog): Promise<AuditLog> {
    const [result] = await db.insert(auditLog).values(entry).returning();
    return result;
  },

  async findAll(): Promise<AuditLog[]> {
    return await db.select().from(auditLog).orderBy(desc(auditLog.createdAt));
  },

  /** Fetch a user record by ID (used to verify admin role before audit actions). */
  async findUserById(userId: string): Promise<User | null> {
    const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
    return u ?? null;
  },

  /**
   * Soft-delete a quote and write an audit log row in a single transaction.
   * Returns null when the quote does not exist or is already deleted.
   */
  async softDeleteQuote(params: {
    id: string;
    reason: string;
    performedBy: string;
    performedByName: string;
  }): Promise<{ success: true } | null> {
    const [quoteData] = await db
      .select()
      .from(quote)
      .where(and(eq(quote.id, params.id), isNull(quote.deleted_at)))
      .limit(1);

    if (!quoteData) return null;

    let clientName: string | null = null;
    let clientId: string | null = null;

    if (quoteData.transaction_id) {
      const [txn] = await db
        .select()
        .from(transaction)
        .where(eq(transaction.id, quoteData.transaction_id))
        .limit(1);

      if (txn?.client_id) {
        clientId = txn.client_id;
        const [client] = await db
          .select()
          .from(clientTable)
          .where(eq(clientTable.id, txn.client_id))
          .limit(1);
        if (client) {
          clientName = [client.title, client.firstName, client.surename]
            .filter(Boolean)
            .join(" ")
            .trim();
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: "delete",
        entityType: "quote",
        entityId: params.id,
        entityTitle: quoteData.title || "Untitled Quote",
        entityData: quoteData as Record<string, unknown>,
        reason: params.reason,
        performedBy: params.performedBy,
        performedByName: params.performedByName,
        clientId,
        clientName,
      });
      await tx
        .update(quote)
        .set({ deleted_at: new Date(), deleted_by_v2: params.performedBy, is_active: false })
        .where(eq(quote.id, params.id));
    });

    return { success: true };
  },

  /**
   * Hard-delete a booking and write an audit log row in a single transaction.
   * Returns null when the booking does not exist.
   */
  async hardDeleteBooking(params: {
    id: string;
    reason: string;
    performedBy: string;
    performedByName: string;
  }): Promise<{ success: true } | null> {
    const [bookingData] = await db
      .select()
      .from(booking)
      .where(eq(booking.id, params.id))
      .limit(1);

    if (!bookingData) return null;

    let clientName: string | null = null;
    let clientId: string | null = null;

    if (bookingData.transaction_id) {
      const [txn] = await db
        .select()
        .from(transaction)
        .where(eq(transaction.id, bookingData.transaction_id))
        .limit(1);

      if (txn?.client_id) {
        clientId = txn.client_id;
        const [client] = await db
          .select()
          .from(clientTable)
          .where(eq(clientTable.id, txn.client_id))
          .limit(1);
        if (client) {
          clientName = [client.title, client.firstName, client.surename]
            .filter(Boolean)
            .join(" ")
            .trim();
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: "delete",
        entityType: "booking",
        entityId: params.id,
        entityTitle: bookingData.title || "Untitled Booking",
        entityData: bookingData as Record<string, unknown>,
        reason: params.reason,
        performedBy: params.performedBy,
        performedByName: params.performedByName,
        clientId,
        clientName,
      });
      await tx.delete(booking).where(eq(booking.id, params.id));
    });

    return { success: true };
  },
};
