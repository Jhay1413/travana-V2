import { db } from '../../config/database';
import { feedbackTable } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export const feedbackRepository = {
  async findAll() {
    return db.select().from(feedbackTable).orderBy(desc(feedbackTable.createdAt));
  },

  async findById(id: string) {
    const [row] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id)).limit(1);
    return row || undefined;
  },

  async findByUserId(userId: string) {
    return db.select().from(feedbackTable).where(eq(feedbackTable.userId, userId)).orderBy(desc(feedbackTable.createdAt));
  },

  async create(data: any) {
    const [row] = await db.insert(feedbackTable).values(data).returning();
    return row;
  },

  async updateStatus(id: string, status: string, adminNotes?: string) {
    const updates: Record<string, any> = { status, updatedAt: new Date() };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    const [row] = await db.update(feedbackTable).set(updates).where(eq(feedbackTable.id, id)).returning();
    return row || undefined;
  },

  async remove(id: string) {
    await db.delete(feedbackTable).where(eq(feedbackTable.id, id));
  },
};
