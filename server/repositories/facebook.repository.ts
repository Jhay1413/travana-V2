import { db } from "../config/database";
import { facebookPages } from "@shared/schema";
import type { FacebookPage, InsertFacebookPage } from "../types/facebook";
import { eq, and } from "drizzle-orm";

export const facebookRepository = {
  async findByUserId(userId: string): Promise<FacebookPage[]> {
    return db.select().from(facebookPages).where(eq(facebookPages.userId, userId));
  },

  async findByPageId(pageId: string): Promise<FacebookPage | undefined> {
    const results = await db.select().from(facebookPages).where(eq(facebookPages.pageId, pageId)).limit(1);
    return results[0];
  },

  async findByUserAndPageId(userId: string, pageId: string): Promise<FacebookPage | undefined> {
    const results = await db
      .select()
      .from(facebookPages)
      .where(and(eq(facebookPages.userId, userId), eq(facebookPages.pageId, pageId)))
      .limit(1);
    return results[0];
  },

  async create(data: InsertFacebookPage): Promise<FacebookPage> {
    const [result] = await db.insert(facebookPages).values(data).returning();
    return result;
  },

  async upsert(data: InsertFacebookPage): Promise<FacebookPage> {
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

  async remove(id: string): Promise<void> {
    await db.delete(facebookPages).where(eq(facebookPages.id, id));
  },
};
