import { db } from "../../config/database";
import { clientFiles, user, booking, quote, enquiry_table, transaction, InsertClientFile, ClientFile } from "@shared/schema";
import { and, eq, desc, getTableColumns } from "drizzle-orm";

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

  /** True when the booking, quote or enquiry with this id sits on a deal (transaction) of this client. */
  async recordBelongsToClient(kind: "booking" | "quote" | "enquiry", recordId: string, clientId: string): Promise<boolean> {
    // Ids are uuids: anything else cannot be a record, and must not reach a uuid comparison.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) return false;
    const table = kind === "booking" ? booking : kind === "quote" ? quote : enquiry_table;
    const [row] = await db
      .select({ id: table.id })
      .from(table)
      .innerJoin(transaction, eq(table.transaction_id, transaction.id))
      .where(and(eq(table.id, recordId), eq(transaction.client_id, clientId)))
      .limit(1);
    return !!row;
  },

  async create(data: InsertClientFile): Promise<ClientFile> {
    const [row] = await db.insert(clientFiles).values(data).returning();
    return row;
  },

  async remove(id: string): Promise<void> {
    await db.delete(clientFiles).where(eq(clientFiles.id, id));
  },
};
