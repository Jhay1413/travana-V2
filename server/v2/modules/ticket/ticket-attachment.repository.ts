import { db } from '../../config/database';
import { ticketAttachments, tickets, type TicketAttachment, type InsertTicketAttachment } from '@shared/schema';
import { and, eq, desc } from 'drizzle-orm';

export const ticketAttachmentRepository = {
  async findById(id: string): Promise<TicketAttachment | undefined> {
    const [result] = await db.select().from(ticketAttachments).where(eq(ticketAttachments.id, id)).limit(1);
    return result;
  },

  async findByIdWithOrg(id: string) {
    const [result] = await db
      .select({
        id: ticketAttachments.id,
        ticketId: ticketAttachments.ticketId,
        filename: ticketAttachments.filename,
        originalName: ticketAttachments.originalName,
        mimeType: ticketAttachments.mimeType,
        ticketOrgId: tickets.orgId,
      })
      .from(ticketAttachments)
      .leftJoin(tickets, eq(ticketAttachments.ticketId, tickets.id))
      .where(eq(ticketAttachments.id, id))
      .limit(1);
    return result ?? null;
  },

  async ticketBelongsToOrg(ticketId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async findByTicketId(ticketId: string): Promise<TicketAttachment[]> {
    return db
      .select()
      .from(ticketAttachments)
      .where(eq(ticketAttachments.ticketId, ticketId))
      .orderBy(desc(ticketAttachments.createdAt));
  },

  async create(attachment: InsertTicketAttachment): Promise<TicketAttachment> {
    const [result] = await db.insert(ticketAttachments).values(attachment).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(ticketAttachments).where(eq(ticketAttachments.id, id));
  },
};
