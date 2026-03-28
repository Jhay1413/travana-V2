import { db } from "../config/database";
import { clientFiles, InsertClientFile, ClientFile } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const clientFileRepository = {
  async findById(id: string): Promise<ClientFile | null> {
    const [row] = await db.select().from(clientFiles).where(eq(clientFiles.id, id));
    return row ?? null;
  },

  async findByClientId(clientId: string): Promise<ClientFile[]> {
    return db
      .select()
      .from(clientFiles)
      .where(eq(clientFiles.clientId, clientId))
      .orderBy(desc(clientFiles.createdAt));
  },

  async create(data: InsertClientFile): Promise<ClientFile> {
    const [row] = await db.insert(clientFiles).values(data).returning();
    return row;
  },

  async remove(id: string): Promise<void> {
    await db.delete(clientFiles).where(eq(clientFiles.id, id));
  },
};
