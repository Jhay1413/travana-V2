import { db } from "../../config/database";
import { clients, type Client, type InsertClient } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

export const clientRepository = {
  async findById(id: string): Promise<Client | undefined> {
    const [result] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(desc(clients.createdAt));
  },

  async create(client: InsertClient): Promise<Client> {
    const id = randomUUID();
    const name = [client.firstName, client.lastName].filter(Boolean).join(" ");
    const [result] = await db.insert(clients).values({ ...client, id, name }).returning();
    return result;
  },

  async update(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [result] = await db.update(clients).set(client).where(eq(clients.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  },
};
