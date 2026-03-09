import { db } from "../config/database";
import { feedbackTable } from "@shared/schema";
import type { Feedback, InsertFeedback } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const feedbackRepository = {
  async findAll(): Promise<Feedback[]> {
    return db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt));
  },

  async findById(id: string): Promise<Feedback | undefined> {
    const [result] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id)).limit(1);
    return result;
  },

  async findByUserId(userId: string): Promise<Feedback[]> {
    return db.select().from(feedbackTable).where(eq(feedbackTable.userId, userId)).orderBy(desc(feedbackTable.createdAt));
  },

  async create(data: InsertFeedback): Promise<Feedback> {
    const [result] = await db.insert(feedbackTable).values(data).returning();
    return result;
  },

  async updateStatus(id: string, status: string, adminNotes?: string): Promise<Feedback | undefined> {
    const updates: Record<string, any> = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    const [result] = await db.update(feedbackTable).set(updates).where(eq(feedbackTable.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(feedbackTable).where(eq(feedbackTable.id, id));
  },
};
