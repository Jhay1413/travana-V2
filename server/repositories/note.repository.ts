import { db } from "../config/database";
import { notes, type Note, type InsertNote } from "@shared/schema";
import { eq, desc, isNull } from "drizzle-orm";

export const noteRepository = {
  async findByQuoteId(quoteId: string): Promise<Note[]> {
    return await db.select().from(notes).where(eq(notes.quoteId, quoteId)).orderBy(desc(notes.createdAt));
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
    const [result] = await db.update(notes).set({ content, updatedAt: new Date() }).where(eq(notes.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  },
};
