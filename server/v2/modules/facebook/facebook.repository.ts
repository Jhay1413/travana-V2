import { db } from '../../config/database';
import { facebookPages } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export const facebookRepository = {
  async findByUserId(userId: string) {
    return db.select().from(facebookPages).where(eq(facebookPages.userId, userId));
  },

  async findByPageId(pageId: string) {
    const [row] = await db.select().from(facebookPages).where(eq(facebookPages.pageId, pageId)).limit(1);
    return row || undefined;
  },

  async findByUserAndPageId(userId: string, pageId: string) {
    const [row] = await db
      .select()
      .from(facebookPages)
      .where(and(eq(facebookPages.userId, userId), eq(facebookPages.pageId, pageId)))
      .limit(1);
    return row || undefined;
  },

  async create(data: any) {
    const [row] = await db.insert(facebookPages).values(data).returning();
    return row;
  },

  async upsert(data: any) {
    const existing = await this.findByUserAndPageId(data.userId, data.pageId);
    if (existing) {
      const [updated] = await db
        .update(facebookPages)
        .set({ encryptedAccessToken: data.encryptedAccessToken, pageName: data.pageName, updatedAt: new Date() })
        .where(eq(facebookPages.id, existing.id))
        .returning();
      return updated;
    }
    return this.create(data);
  },

  async remove(id: string) {
    await db.delete(facebookPages).where(eq(facebookPages.id, id));
  },
};
