import { db } from "../../config/database";
import { clientFiles, user, InsertClientFile, ClientFile } from "@shared/schema";
import { eq, desc, getTableColumns } from "drizzle-orm";

export type ClientFileWithUploader = ClientFile & { uploadedByName: string | null };

export const clientFileRepository = {
  async findById(id: string): Promise<ClientFile | null> {
    const [row] = await db.select().from(clientFiles).where(eq(clientFiles.id, id));
    return row ?? null;
  },

  async findByClientId(clientId: string): Promise<ClientFileWithUploader[]> {
    return db
      .select({ ...getTableColumns(clientFiles), uploadedByName: user.name })
      .from(clientFiles)
      .leftJoin(user, eq(user.id, clientFiles.uploadedBy))
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
