import { db } from "../config/database";
import { enquiryNotes, type EnquiryNote, type InsertEnquiryNote } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const enquiryNoteRepository = {
  async findByEnquiryId(enquiryId: string): Promise<EnquiryNote[]> {
    return await db.select().from(enquiryNotes).where(eq(enquiryNotes.enquiryId, enquiryId)).orderBy(desc(enquiryNotes.createdAt));
  },

  async findById(id: string): Promise<EnquiryNote | undefined> {
    const [result] = await db.select().from(enquiryNotes).where(eq(enquiryNotes.id, id));
    return result;
  },

  async create(note: InsertEnquiryNote): Promise<EnquiryNote> {
    const [result] = await db.insert(enquiryNotes).values(note).returning();
    return result;
  },

  async update(id: string, content: string): Promise<EnquiryNote | undefined> {
    const [result] = await db.update(enquiryNotes).set({ content, updatedAt: new Date() }).where(eq(enquiryNotes.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(enquiryNotes).where(eq(enquiryNotes.id, id));
  },
};
