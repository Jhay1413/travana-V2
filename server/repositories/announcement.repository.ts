import { db } from "../config/database";
import { hubAnnouncementTable } from "@shared/schema";
import type { HubAnnouncement, InsertHubAnnouncement } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const announcementRepository = {
  async findAll(): Promise<HubAnnouncement[]> {
    return db.select().from(hubAnnouncementTable).orderBy(desc(hubAnnouncementTable.createdAt));
  },

  async findById(id: string): Promise<HubAnnouncement | undefined> {
    const [result] = await db.select().from(hubAnnouncementTable).where(eq(hubAnnouncementTable.id, id)).limit(1);
    return result;
  },

  async create(data: InsertHubAnnouncement): Promise<HubAnnouncement> {
    const [result] = await db.insert(hubAnnouncementTable).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertHubAnnouncement>): Promise<HubAnnouncement | undefined> {
    const [result] = await db.update(hubAnnouncementTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hubAnnouncementTable.id, id))
      .returning();
    return result;
  },

  async togglePin(id: string): Promise<HubAnnouncement | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;
    const [result] = await db.update(hubAnnouncementTable)
      .set({ pinned: !existing.pinned, updatedAt: new Date() })
      .where(eq(hubAnnouncementTable.id, id))
      .returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(hubAnnouncementTable).where(eq(hubAnnouncementTable.id, id));
  },
};
