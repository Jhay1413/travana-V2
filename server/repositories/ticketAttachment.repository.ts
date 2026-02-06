import { db } from "../config/database";
import { ticketAttachments, type TicketAttachment, type InsertTicketAttachment } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const ticketAttachmentRepository = {
  async findById(id: string): Promise<TicketAttachment | undefined> {
    const [result] = await db.select().from(ticketAttachments).where(eq(ticketAttachments.id, id)).limit(1);
    return result;
  },

  async findByTicketId(ticketId: string): Promise<TicketAttachment[]> {
    return await db.select().from(ticketAttachments).where(eq(ticketAttachments.ticketId, ticketId)).orderBy(desc(ticketAttachments.createdAt));
  },

  async create(attachment: InsertTicketAttachment): Promise<TicketAttachment> {
    const [result] = await db.insert(ticketAttachments).values(attachment).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(ticketAttachments).where(eq(ticketAttachments.id, id));
  },
};
