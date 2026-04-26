import { db } from "../config/database";
import {
  smsTemplatesTable,
  smsMessagesTable,
  clientTable,
  type SmsTemplate,
  type InsertSmsTemplate,
  type SmsMessage,
  type InsertSmsMessage,
  type NeonClient,
} from "@shared/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

export const smsRepository = {
  async listTemplates(): Promise<SmsTemplate[]> {
    return db
      .select()
      .from(smsTemplatesTable)
      .orderBy(desc(smsTemplatesTable.updatedAt));
  },

  async findTemplate(id: string): Promise<SmsTemplate | undefined> {
    const [row] = await db
      .select()
      .from(smsTemplatesTable)
      .where(eq(smsTemplatesTable.id, id))
      .limit(1);
    return row;
  },

  async findTemplateByCategory(category: SmsTemplate["category"]): Promise<SmsTemplate | undefined> {
    const [row] = await db
      .select()
      .from(smsTemplatesTable)
      .where(and(eq(smsTemplatesTable.category, category), eq(smsTemplatesTable.active, true)))
      .orderBy(desc(smsTemplatesTable.updatedAt))
      .limit(1);
    return row;
  },

  async createTemplate(input: InsertSmsTemplate): Promise<SmsTemplate> {
    const [row] = await db.insert(smsTemplatesTable).values(input).returning();
    return row;
  },

  async updateTemplate(id: string, patch: Partial<InsertSmsTemplate>): Promise<SmsTemplate | undefined> {
    const [row] = await db
      .update(smsTemplatesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(smsTemplatesTable.id, id))
      .returning();
    return row;
  },

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(smsTemplatesTable).where(eq(smsTemplatesTable.id, id));
  },

  async countTemplates(): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(smsTemplatesTable);
    return row?.c ?? 0;
  },

  async createMessage(input: InsertSmsMessage): Promise<SmsMessage> {
    const [row] = await db.insert(smsMessagesTable).values(input).returning();
    return row;
  },

  async listMessages(opts: { limit?: number; clientId?: string } = {}): Promise<SmsMessage[]> {
    const limit = opts.limit ?? 200;
    if (opts.clientId) {
      return db
        .select()
        .from(smsMessagesTable)
        .where(eq(smsMessagesTable.clientId, opts.clientId))
        .orderBy(desc(smsMessagesTable.sentAt))
        .limit(limit);
    }
    return db
      .select()
      .from(smsMessagesTable)
      .orderBy(desc(smsMessagesTable.sentAt))
      .limit(limit);
  },

  async findClientById(id: string): Promise<NeonClient | undefined> {
    const [row] = await db.select().from(clientTable).where(eq(clientTable.id, id)).limit(1);
    return row;
  },

  async setClientOptIn(id: string, optIn: boolean): Promise<void> {
    await db
      .update(clientTable)
      .set({ smsOptIn: optIn })
      .where(eq(clientTable.id, id));
  },

  async resolveRecipients(filter: {
    mode: "client" | "all_optin" | "vip_tier" | "badge" | "list";
    clientId?: string;
    clientIds?: string[];
    vipTier?: "standard" | "gold" | "elite";
    badge?: string;
  }): Promise<NeonClient[]> {
    if (filter.mode === "client" && filter.clientId) {
      const c = await this.findClientById(filter.clientId);
      return c ? [c] : [];
    }
    if (filter.mode === "list" && filter.clientIds?.length) {
      return db
        .select()
        .from(clientTable)
        .where(sql`${clientTable.id} = ANY(${filter.clientIds})`);
    }
    const conditions = [
      eq(clientTable.smsOptIn, true),
      isNotNull(clientTable.phoneNumber),
    ];
    if (filter.mode === "vip_tier" && filter.vipTier) {
      conditions.push(eq(clientTable.vipTier, filter.vipTier));
    }
    if (filter.mode === "badge" && filter.badge) {
      conditions.push(eq(clientTable.badge, filter.badge));
    }
    return db.select().from(clientTable).where(and(...conditions));
  },
};
