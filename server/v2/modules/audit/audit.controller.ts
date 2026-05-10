import { Request, Response } from 'express';
import { auditService } from './audit.service';
import { asyncHandler } from '../../utils/async-handler';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../utils/get-user-id';
import { getScope } from '../../utils/scope';
import { db } from '../../config/database';
import {
  quote,
  transaction,
  clientTable,
  user as userTable,
  booking,
  auditLog,
} from '@shared/schema';
import { eq, isNull, and } from 'drizzle-orm';

function scopeOrgId(req: Request): string | null {
  // Platform admins see across orgs; everyone else is restricted to their own.
  if (req.orgRole === 'platform_admin') return null;
  if (!req.orgId) throw new AppError('No organisation context', 403);
  return req.orgId;
}

async function getUserRecord(userId: string) {
  const [u] = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1);
  return u || null;
}

async function resolveEntityOrgId(transactionId: string | null) {
  if (!transactionId) return { orgId: null as string | null, clientId: null as string | null, clientName: null as string | null };
  const [txn] = await db.select().from(transaction).where(eq(transaction.id, transactionId)).limit(1);
  if (!txn?.client_id) return { orgId: null, clientId: null, clientName: null };
  const [client] = await db.select().from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1);
  if (!client) return { orgId: null, clientId: txn.client_id, clientName: null };
  const clientName = [client.title, client.firstName, client.surename].filter(Boolean).join(' ').trim() || null;
  return { orgId: client.orgId, clientId: txn.client_id, clientName };
}

export const auditController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const logs = await auditService.findAll(scope);
    res.json({ success: true, data: logs });
  }),

  deleteQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const userId = getUserId(req);
    if (!userId) throw new AppError('Not authenticated', 401);
    const userRecord = await getUserRecord(userId);
    if (!userRecord) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ success: false, error: 'Reason is required' });

    const [quoteData] = await db.select().from(quote).where(and(eq(quote.id, id), isNull(quote.deleted_at))).limit(1);
    if (!quoteData) return res.status(404).json({ success: false, error: 'Quote not found' });

    const { orgId, clientId, clientName } = await resolveEntityOrgId(quoteData.transaction_id ?? null);

    const callerOrgId = scope.orgRole === 'platform_admin' ? null : (scope.orgId || null);
    if (callerOrgId && orgId !== callerOrgId) {
      return res.status(404).json({ success: false, error: 'Quote not found' });
    }

    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: 'delete', entityType: 'quote', entityId: id,
        entityTitle: quoteData.title || 'Untitled Quote', entityData: quoteData as any,
        reason: reason.trim(), performedBy: userId,
        performedByName: userRecord.name || userRecord.email || 'Unknown',
        clientId, clientName,
      });
      await tx.update(quote).set({ deleted_at: new Date(), deleted_by_v2: userId, is_active: false }).where(eq(quote.id, id));
    });
    res.json({ success: true, message: 'Quote deleted successfully' });
  }),

  deleteBooking: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const userId = getUserId(req);
    if (!userId) throw new AppError('Not authenticated', 401);
    const userRecord = await getUserRecord(userId);
    if (!userRecord) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ success: false, error: 'Reason is required' });

    const [bookingData] = await db.select().from(booking).where(eq(booking.id, id)).limit(1);
    if (!bookingData) return res.status(404).json({ success: false, error: 'Booking not found' });

    const { orgId, clientId, clientName } = await resolveEntityOrgId(bookingData.transaction_id ?? null);

    const callerOrgId = scope.orgRole === 'platform_admin' ? null : (scope.orgId || null);
    if (callerOrgId && orgId !== callerOrgId) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    await db.transaction(async (tx) => {
      await tx.insert(auditLog).values({
        action: 'delete', entityType: 'booking', entityId: id,
        entityTitle: bookingData.title || 'Untitled Booking', entityData: bookingData as any,
        reason: reason.trim(), performedBy: userId,
        performedByName: userRecord.name || userRecord.email || 'Unknown',
        clientId, clientName,
      });
      await tx.delete(booking).where(eq(booking.id, id));
    });
    res.json({ success: true, message: 'Booking deleted successfully' });
  }),
};
