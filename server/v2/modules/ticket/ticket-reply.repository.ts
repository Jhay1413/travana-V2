import { db } from '../../config/database';
import { ticketReplies, tickets, type TicketReply, type InsertTicketReply } from '@shared/schema';
import { and, eq, asc } from 'drizzle-orm';

export const ticketReplyRepository = {
  async findById(id: string): Promise<TicketReply | undefined> {
    const [result] = await db.select().from(ticketReplies).where(eq(ticketReplies.id, id)).limit(1);
    return result;
  },

  async findByIdWithOrg(id: string) {
    const [result] = await db
      .select({
        id: ticketReplies.id,
        ticketId: ticketReplies.ticketId,
        userId: ticketReplies.userId,
        ticketOrgId: tickets.orgId,
      })
      .from(ticketReplies)
      .leftJoin(tickets, eq(ticketReplies.ticketId, tickets.id))
      .where(eq(ticketReplies.id, id))
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

  async findByTicketId(ticketId: string): Promise<TicketReply[]> {
    return db
      .select()
      .from(ticketReplies)
      .where(eq(ticketReplies.ticketId, ticketId))
      .orderBy(asc(ticketReplies.createdAt));
  },

  async create(reply: InsertTicketReply): Promise<TicketReply> {
    const [result] = await db.insert(ticketReplies).values(reply).returning();
    return result;
  },

  async update(id: string, content: string): Promise<TicketReply | undefined> {
    const [result] = await db
      .update(ticketReplies)
      .set({ content, updatedAt: new Date() })
      .where(eq(ticketReplies.id, id))
      .returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(ticketReplies).where(eq(ticketReplies.id, id));
  },
};
