import { db } from "../../config/database";
import { notifications, type Notification, type InsertNotification } from "@shared/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export const notificationRepository = {
  async findById(id: string): Promise<Notification | undefined> {
    const [result] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return result;
  },

  async findByUserId(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  },

  async findUnreadByUserId(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false))).orderBy(desc(notifications.createdAt));
  },

  async create(notification: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result;
  },

  async markRead(id: string): Promise<Notification | undefined> {
    const [result] = await db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).returning();
    return result;
  },

  async markAllRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  },

  async remove(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  },

  /**
   * Find existing (userId, link) pairs for a given notification type, used to
   * dedupe reminder fan-outs (e.g. don't send two stale-ticket reminders for
   * the same ticket to the same user).
   */
  async findExistingByTypeAndLinks(type: string, links: string[]): Promise<Array<{ userId: string; link: string | null }>> {
    if (links.length === 0) return [];
    return db
      .select({ link: notifications.link, userId: notifications.userId })
      .from(notifications)
      .where(and(eq(notifications.type, type), inArray(notifications.link, links)));
  },
};
