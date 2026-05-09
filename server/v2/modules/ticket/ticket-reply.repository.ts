import { db } from '../../config/database';
import { ticketReplies, type TicketReply, type InsertTicketReply } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';

export const ticketReplyRepository = {
  async findById(id: string): Promise<TicketReply | undefined> {
    const [result] = await db.select().from(ticketReplies).where(eq(ticketReplies.id, id)).limit(1);
    return result;
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
