import { db } from "../../config/database";
import { notes, user, type Note, type InsertNote } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

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
