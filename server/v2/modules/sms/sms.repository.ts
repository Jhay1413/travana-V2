import { db } from '../../config/database';
import {
  smsTemplatesTable,
  smsMessagesTable,
  clientTable,
  transaction as transactionTable,
  booking as bookingTable,
  quote as quoteTable,
  organization as organizationTable,
} from '@shared/schema';
import { and, desc, eq, gte, isNotNull, inArray, sql } from 'drizzle-orm';

export const smsRepository = {
  /** List templates owned by an org, or all of them when orgId is null (platform_admin). */
  async listTemplates(orgId: string | null) {
    const q = db.select().from(smsTemplatesTable);
    const scoped = orgId ? q.where(eq(smsTemplatesTable.orgId, orgId)) : q;
    return scoped.orderBy(desc(smsTemplatesTable.updatedAt));
  },

  /** Find a template by id, optionally scoped to an org (returns undefined if not owned). */
  async findTemplate(id: string, orgId: string | null = null) {
    const conditions = [eq(smsTemplatesTable.id, id)];
    if (orgId) conditions.push(eq(smsTemplatesTable.orgId, orgId));
    const [row] = await db.select().from(smsTemplatesTable).where(and(...conditions)).limit(1);
    return row || undefined;
  },

  /** Used by ensureSeed() to check whether an org already has a template of this category. */
  async findTemplateByCategory(orgId: string, category: string) {
    const [row] = await db
      .select()
      .from(smsTemplatesTable)
      .where(and(
        eq(smsTemplatesTable.orgId, orgId),
        eq(smsTemplatesTable.category, category as any),
      ))
      .orderBy(desc(smsTemplatesTable.updatedAt))
      .limit(1);
    return row || undefined;
  },

  /** Active templates with a given auto-trigger for a single org, used by the auto-fire engine. */
  async findActiveTemplatesByTrigger(orgId: string, autoTrigger: string) {
    return db
      .select()
      .from(smsTemplatesTable)
      .where(and(
        eq(smsTemplatesTable.orgId, orgId),
        eq(smsTemplatesTable.autoTrigger, autoTrigger as any),
        eq(smsTemplatesTable.active, true),
      ))
      .orderBy(desc(smsTemplatesTable.updatedAt));
  },

  /** All active templates with a given auto-trigger across every org. Used by the cron sweep. */
  async findAllActiveTemplatesByTrigger(autoTrigger: string) {
    return db
      .select()
      .from(smsTemplatesTable)
      .where(and(
        eq(smsTemplatesTable.autoTrigger, autoTrigger as any),
        eq(smsTemplatesTable.active, true),
      ))
      .orderBy(desc(smsTemplatesTable.updatedAt));
  },

  /**
   * Has this template already been auto-sent to this client since `since`?
   * Used as idempotency for the days-before-departure cron and to avoid
   * accidentally re-firing on_booking_create / on_pin_set if the same event
   * is processed twice.
   */
  async hasRecentAutoSend(templateId: string, clientId: string, since: Date) {
    const [row] = await db
      .select({ id: smsMessagesTable.id })
      .from(smsMessagesTable)
      .where(and(
        eq(smsMessagesTable.templateId, templateId),
        eq(smsMessagesTable.clientId, clientId),
        gte(smsMessagesTable.sentAt, since),
        inArray(smsMessagesTable.status, ['queued', 'sent', 'delivered'] as any),
      ))
      .limit(1);
    return !!row;
  },

  async createTemplate(input: any) {
    const [row] = await db.insert(smsTemplatesTable).values(input).returning();
    return row;
  },

  async updateTemplate(id: string, orgId: string | null, patch: any) {
    const conditions = [eq(smsTemplatesTable.id, id)];
    if (orgId) conditions.push(eq(smsTemplatesTable.orgId, orgId));
    const [row] = await db
      .update(smsTemplatesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return row || undefined;
  },

  async deleteTemplate(id: string, orgId: string | null) {
    const conditions = [eq(smsTemplatesTable.id, id)];
    if (orgId) conditions.push(eq(smsTemplatesTable.orgId, orgId));
    await db.delete(smsTemplatesTable).where(and(...conditions));
  },

  async countTemplates(orgId: string): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(smsTemplatesTable)
      .where(eq(smsTemplatesTable.orgId, orgId));
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

  async findOrgNameById(orgId: string): Promise<string | undefined> {
    const [row] = await db
      .select({ name: organizationTable.name })
      .from(organizationTable)
      .where(eq(organizationTable.id, orgId))
      .limit(1);
    return row?.name ?? undefined;
  },

  /** Look up the org of a client, used to scope auto-fire template lookups. */
  async findClientOrgId(clientId: string): Promise<string | null> {
    const [row] = await db
      .select({ orgId: clientTable.orgId })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);
    return row?.orgId ?? null;
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

  /**
   * Active bookings whose travel_date is exactly `targetDate`. Used by the
   * days-before-departure cron to fan out per-booking auto-fires.
   */
  async findActiveBookingsByTravelDate(targetDate: string) {
    return db
      .select({
        bookingId: bookingTable.id,
        clientId: transactionTable.client_id,
        transactionId: bookingTable.transaction_id,
      })
      .from(bookingTable)
      .innerJoin(transactionTable, eq(bookingTable.transaction_id, transactionTable.id))
      .where(and(
        eq(bookingTable.is_active, true),
        eq(transactionTable.is_active, true),
        eq(bookingTable.travel_date, targetDate),
        isNotNull(transactionTable.client_id),
      ));
  },

  /**
   * Find the most recent active quote for a client that has a public share
   * token. Returned `{ token }` is used to render the {{quote_url}} SMS
   * placeholder.
   */
  async findLatestTokenedQuoteForClient(clientId: string) {
    const [row] = await db
      .select({ token: quoteTable.quote_token, id: quoteTable.id })
      .from(quoteTable)
      .innerJoin(transactionTable, eq(quoteTable.transaction_id, transactionTable.id))
      .where(and(
        eq(transactionTable.client_id, clientId),
        eq(transactionTable.is_active, true),
        isNotNull(quoteTable.quote_token),
      ))
      .orderBy(desc(quoteTable.date_created))
      .limit(1);
    return row || undefined;
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
