import { db } from '../../config/database';
import { hubAnnouncementTable, hubAnnouncementLikesTable, hubAnnouncementHidesTable } from '@shared/schema';
import { and, count, desc, eq } from 'drizzle-orm';

export const announcementRepository = {
  async findAll(category?: string) {
    const query = db.select().from(hubAnnouncementTable);
    if (category) {
      return query.where(eq(hubAnnouncementTable.category, category)).orderBy(desc(hubAnnouncementTable.createdAt));
    }
    return query.orderBy(desc(hubAnnouncementTable.createdAt));
  },

  async findById(id: string) {
    const [row] = await db.select().from(hubAnnouncementTable).where(eq(hubAnnouncementTable.id, id)).limit(1);
    return row || undefined;
  },

  async create(data: any) {
    const [row] = await db.insert(hubAnnouncementTable).values(data).returning();
    return row;
  },

  async update(id: string, data: any) {
    const [row] = await db.update(hubAnnouncementTable).set({ ...data, updatedAt: new Date() }).where(eq(hubAnnouncementTable.id, id)).returning();
    return row || undefined;
  },

  async togglePin(id: string) {
    const existing = await this.findById(id);
    if (!existing) return undefined;
    const [row] = await db.update(hubAnnouncementTable).set({ pinned: !existing.pinned, updatedAt: new Date() }).where(eq(hubAnnouncementTable.id, id)).returning();
    return row || undefined;
  },

  async remove(id: string) {
    await db.delete(hubAnnouncementTable).where(eq(hubAnnouncementTable.id, id));
  },

  // ─── Per-user hide (profile wall) ───────────────────────────────────────────

  async hide(announcementId: string, userId: string) {
    await db.insert(hubAnnouncementHidesTable).values({ announcementId, userId }).onConflictDoNothing();
  },

  async findHiddenIdsByUser(userId: string): Promise<string[]> {
    const rows = await db
      .select({ announcementId: hubAnnouncementHidesTable.announcementId })
      .from(hubAnnouncementHidesTable)
      .where(eq(hubAnnouncementHidesTable.userId, userId));
    return rows.map((r) => r.announcementId);
  },

  // ─── Likes ────────────────────────────────────────────────────────────────

  /**
   * Toggle a user's like on an announcement. Returns the new liked state.
   */
  async toggleLike(announcementId: string, userId: string): Promise<{ liked: boolean }> {
    const [existing] = await db
      .select({ id: hubAnnouncementLikesTable.id })
      .from(hubAnnouncementLikesTable)
      .where(
        and(
          eq(hubAnnouncementLikesTable.announcementId, announcementId),
          eq(hubAnnouncementLikesTable.userId, userId),
        ),
      )
      .limit(1);
    if (existing) {
      await db.delete(hubAnnouncementLikesTable).where(eq(hubAnnouncementLikesTable.id, existing.id));
      return { liked: false };
    }
    await db.insert(hubAnnouncementLikesTable).values({ announcementId, userId });
    return { liked: true };
  },

  async countLikesGroupedByAnnouncement(): Promise<Array<{ announcementId: string; count: number }>> {
    return db
      .select({ announcementId: hubAnnouncementLikesTable.announcementId, count: count() })
      .from(hubAnnouncementLikesTable)
      .groupBy(hubAnnouncementLikesTable.announcementId);
  },

  async findAnnouncementIdsLikedByUser(userId: string): Promise<string[]> {
    const rows = await db
      .select({ announcementId: hubAnnouncementLikesTable.announcementId })
      .from(hubAnnouncementLikesTable)
      .where(eq(hubAnnouncementLikesTable.userId, userId));
    return rows.map((r) => r.announcementId);
  },

  async countLikesFor(announcementId: string): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(hubAnnouncementLikesTable)
      .where(eq(hubAnnouncementLikesTable.announcementId, announcementId));
    return row?.count ?? 0;
  },

  async hasUserLiked(announcementId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: hubAnnouncementLikesTable.id })
      .from(hubAnnouncementLikesTable)
      .where(
        and(
          eq(hubAnnouncementLikesTable.announcementId, announcementId),
          eq(hubAnnouncementLikesTable.userId, userId),
        ),
      )
      .limit(1);
    return !!row;
  },
};
