import { db } from "../../config/database";
import { notes, transaction, clientTable, user, type Note, type InsertNote } from "@shared/schema";
import { and, eq, desc, sql } from "drizzle-orm";

export type NoteWithAuthor = Note & { author_name: string | null };

export const noteRepository = {
  async findByTransactionId(transactionId: string): Promise<NoteWithAuthor[]> {
    const rows = await db
      .select({
        id: notes.id,
        description: notes.description,
        content: notes.content,
        agent_id: notes.agent_id,
        user_id: notes.user_id,
        createdAt: notes.createdAt,
        parent_id: notes.parent_id,
        transaction_id: notes.transaction_id,
        client_id: notes.client_id,
        author_name: user.name,
      })
      .from(notes)
      .leftJoin(user, eq(notes.agent_id, user.id))
      .where(eq(notes.transaction_id, transactionId))
      .orderBy(desc(notes.createdAt));
    return rows;
  },

  async findById(id: string): Promise<Note | undefined> {
    const [result] = await db.select().from(notes).where(eq(notes.id, id));
    return result;
  },

  async findByIdWithOrg(id: string) {
    // Resolve org via either note.client_id directly OR note.transaction_id → transaction.client_id.
    const [result] = await db
      .select({
        id: notes.id,
        transaction_id: notes.transaction_id,
        client_id: notes.client_id,
        // COALESCE: prefer the note's own client_id, fall back to the transaction's client_id.
        orgId: sql<string | null>`COALESCE(direct_client.org_id, txn_client.org_id)`,
      })
      .from(notes)
      .leftJoin(sql`${clientTable} AS direct_client`, sql`direct_client.id = ${notes.client_id}`)
      .leftJoin(transaction, eq(notes.transaction_id, transaction.id))
      .leftJoin(sql`${clientTable} AS txn_client`, sql`txn_client.id = ${transaction.client_id}`)
      .where(eq(notes.id, id))
      .limit(1);
    return result ?? null;
  },

  async transactionBelongsToOrg(transactionId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: transaction.id })
      .from(transaction)
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(eq(transaction.id, transactionId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async clientBelongsToOrg(clientId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: clientTable.id })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async create(note: InsertNote): Promise<Note> {
    const [result] = await db.insert(notes).values(note).returning();
    return result;
  },

  async update(id: string, content: string): Promise<Note | undefined> {
    const [result] = await db.update(notes).set({ content }).where(eq(notes.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  },
};
