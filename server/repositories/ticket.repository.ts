import { db } from "../config/database";
import { tickets, clientTable, user, type Ticket, type InsertTicket } from "@shared/schema";
import { eq, desc, sql, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const assignedUser = alias(user, "assigned_user");

export type TicketWithNames = Ticket & { clientName: string | null; userName: string | null; assignedToName: string | null };

function buildTicketWithNamesQuery() {
  return db
    .select({
      id: tickets.id,
      clientId: tickets.clientId,
      userId: tickets.userId,
      assignedTo: tickets.assignedTo,
      type: tickets.type,
      status: tickets.status,
      priority: tickets.priority,
      subject: tickets.subject,
      description: tickets.description,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      resolvedAt: tickets.resolvedAt,
      clientName: sql<string | null>`COALESCE(NULLIF(${clientTable.title}, 'NULL') || ' ', '') || ${clientTable.firstName} || ' ' || ${clientTable.surename}`.as("client_name"),
      userName: user.name,
      assignedToName: sql<string | null>`${assignedUser.name}`.as("assigned_to_name"),
    })
    .from(tickets)
    .leftJoin(clientTable, eq(tickets.clientId, clientTable.id))
    .leftJoin(user, eq(tickets.userId, user.id))
    .leftJoin(assignedUser, eq(tickets.assignedTo, assignedUser.id));
}

export const ticketRepository = {
  async findById(id: string): Promise<TicketWithNames | undefined> {
    const results = await buildTicketWithNamesQuery().where(eq(tickets.id, id)).limit(1);
    return results[0];
  },

  async findAll(): Promise<TicketWithNames[]> {
    return await buildTicketWithNamesQuery().orderBy(desc(tickets.createdAt));
  },

  async findByClientId(clientId: string): Promise<TicketWithNames[]> {
    return await buildTicketWithNamesQuery().where(eq(tickets.clientId, clientId)).orderBy(desc(tickets.createdAt));
  },

  async findByUserId(userId: string): Promise<TicketWithNames[]> {
    return await buildTicketWithNamesQuery().where(eq(tickets.userId, userId)).orderBy(desc(tickets.createdAt));
  },

  async findByAssignedTo(userId: string): Promise<TicketWithNames[]> {
    return await buildTicketWithNamesQuery().where(
      or(eq(tickets.assignedTo, userId), eq(tickets.userId, userId))
    ).orderBy(desc(tickets.createdAt));
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
