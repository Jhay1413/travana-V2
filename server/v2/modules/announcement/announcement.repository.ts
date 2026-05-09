import { db } from '../../config/database';
import { hubAnnouncementTable } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export const announcementRepository = {
  async findAll() {
    return db.select().from(hubAnnouncementTable).orderBy(desc(hubAnnouncementTable.createdAt));
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
};
