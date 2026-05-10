import { db } from '../../config/database';
import {
  smsTemplatesTable,
  smsMessagesTable,
  clientTable,
  transaction as transactionTable,
  booking as bookingTable,
} from '@shared/schema';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';

export const smsRepository = {
  async listTemplates() {
    return db.select().from(smsTemplatesTable).orderBy(desc(smsTemplatesTable.updatedAt));
  },

  async findTemplate(id: string) {
    const [row] = await db.select().from(smsTemplatesTable).where(eq(smsTemplatesTable.id, id)).limit(1);
    return row || undefined;
  },

  async findTemplateByCategory(category: string) {
    const [row] = await db
      .select()
      .from(smsTemplatesTable)
      .where(and(eq(smsTemplatesTable.category, category as any), eq(smsTemplatesTable.active, true)))
      .orderBy(desc(smsTemplatesTable.updatedAt))
      .limit(1);
    return row || undefined;
  },

  async createTemplate(input: any) {
    const [row] = await db.insert(smsTemplatesTable).values(input).returning();
    return row;
  },

  async updateTemplate(id: string, patch: any) {
    const [row] = await db
      .update(smsTemplatesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(smsTemplatesTable.id, id))
      .returning();
    return row || undefined;
  },

  async deleteTemplate(id: string) {
    await db.delete(smsTemplatesTable).where(eq(smsTemplatesTable.id, id));
  },

  async countTemplates(): Promise<number> {
    const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(smsTemplatesTable);
    return row?.c ?? 0;
  },

  async createMessage(input: any) {
    const [row] = await db.insert(smsMessagesTable).values(input).returning();
    return row;
  },

  async listMessages(opts: { limit?: number; clientId?: string; orgId: string | null }) {
    const limit = opts.limit ?? 200;

    const baseQuery = db
      .select({
        id: smsMessagesTable.id,
        clientId: smsMessagesTable.clientId,
        clientName: smsMessagesTable.clientName,
        toPhone: smsMessagesTable.toPhone,
        body: smsMessagesTable.body,
        status: smsMessagesTable.status,
        templateId: smsMessagesTable.templateId,
        templateName: smsMessagesTable.templateName,
        triggerSource: smsMessagesTable.triggerSource,
        triggeredBy: smsMessagesTable.triggeredBy,
        triggeredByName: smsMessagesTable.triggeredByName,
        providerMessageId: smsMessagesTable.providerMessageId,
        providerError: smsMessagesTable.providerError,
        sentAt: smsMessagesTable.sentAt,
      })
      .from(smsMessagesTable)
      .leftJoin(clientTable, eq(smsMessagesTable.clientId, clientTable.id));

    const conditions: any[] = [];
    if (opts.clientId) conditions.push(eq(smsMessagesTable.clientId, opts.clientId));
    if (opts.orgId) conditions.push(eq(clientTable.orgId, opts.orgId));

    const scoped = conditions.length > 0
      ? baseQuery.where(and(...conditions))
      : baseQuery;

    return scoped.orderBy(desc(smsMessagesTable.sentAt)).limit(limit);
  },

  async findClientById(id: string) {
    const [row] = await db.select().from(clientTable).where(eq(clientTable.id, id)).limit(1);
    return row || undefined;
  },

  /**
   * Find the most recent active booking for a client (used to fill SMS template
   * merge fields like balance_due, hays_ref, departure_date).
   */
  async findLatestActiveBookingForClient(clientId: string) {
    const [latestTxn] = await db
      .select({ id: transactionTable.id })
      .from(transactionTable)
      .where(eq(transactionTable.client_id, clientId))
      .orderBy(desc(transactionTable.created_at))
      .limit(1);
    if (!latestTxn) return undefined;
    const [bookingRow] = await db
      .select()
      .from(bookingTable)
      .where(and(eq(bookingTable.transaction_id, latestTxn.id), eq(bookingTable.is_active, true)))
      .limit(1);
    return bookingRow || undefined;
  },

  async findClientByIdInOrg(id: string, orgId: string) {
    const [row] = await db
      .select()
      .from(clientTable)
      .where(and(eq(clientTable.id, id), eq(clientTable.orgId, orgId)))
      .limit(1);
    return row || undefined;
  },

  async setClientOptIn(id: string, optIn: boolean) {
    await db.update(clientTable).set({ smsOptIn: optIn }).where(eq(clientTable.id, id));
  },

  async resolveRecipients(filter: {
    mode: 'client' | 'all_optin' | 'vip_tier' | 'badge' | 'list';
    clientId?: string;
    clientIds?: string[];
    vipTier?: string;
    badge?: string;
    orgId: string | null;
  }) {
    const orgFilter = filter.orgId ? [eq(clientTable.orgId, filter.orgId)] : [];

    if (filter.mode === 'client' && filter.clientId) {
      const conditions = [eq(clientTable.id, filter.clientId), ...orgFilter];
      const rows = await db.select().from(clientTable).where(and(...conditions)).limit(1);
      return rows;
    }
    if (filter.mode === 'list' && filter.clientIds?.length) {
      const conditions = [
        sql`${clientTable.id} = ANY(${filter.clientIds})`,
        ...orgFilter,
      ];
      return db.select().from(clientTable).where(and(...conditions));
    }
    const conditions: any[] = [
      eq(clientTable.smsOptIn, true),
      isNotNull(clientTable.phoneNumber),
      ...orgFilter,
    ];
    if (filter.mode === 'vip_tier' && filter.vipTier) {
      conditions.push(eq(clientTable.vipTier, filter.vipTier as any));
    }
    if (filter.mode === 'badge' && filter.badge) {
      conditions.push(eq(clientTable.badge, filter.badge as any));
    }
    return db.select().from(clientTable).where(and(...conditions));
  },
};
