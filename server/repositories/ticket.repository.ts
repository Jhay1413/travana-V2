import { db } from "../config/database";
import { tickets, type Ticket, type InsertTicket } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const ticketRepository = {
  async findById(id: string): Promise<Ticket | undefined> {
    const [result] = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<Ticket[]> {
    return await db.select().from(tickets).orderBy(desc(tickets.createdAt));
  },

  async findByClientId(clientId: string): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.clientId, clientId)).orderBy(desc(tickets.createdAt));
  },

  async findByUserId(userId: string): Promise<Ticket[]> {
    return await db.select().from(tickets).where(eq(tickets.userId, userId)).orderBy(desc(tickets.createdAt));
  },

  async create(ticket: InsertTicket): Promise<Ticket> {
    const [result] = await db.insert(tickets).values(ticket).returning();
    return result;
  },

  async update(id: string, ticket: Partial<InsertTicket>): Promise<Ticket | undefined> {
    const [result] = await db.update(tickets).set({ ...ticket, updatedAt: new Date() }).where(eq(tickets.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(tickets).where(eq(tickets.id, id));
  },
};
