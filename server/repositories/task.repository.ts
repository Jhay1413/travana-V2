import { db } from "../config/database";
import { tasks, notifications, type Task, type InsertTask } from "@shared/schema";
import { eq, and, desc, lte } from "drizzle-orm";

const entityRouteMap: Record<string, string> = {
  enquiry: "/enquiries",
  quote: "/quotes",
  booking: "/bookings",
};

function entityLink(entityType: string, entityId: string): string {
  const base = entityRouteMap[entityType] ?? `/${entityType}s`;
  return `${base}/${entityId}`;
}

export const taskRepository = {
  async findByEntity(entityType: string, entityId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.entityType, entityType), eq(tasks.entityId, entityId)))
      .orderBy(desc(tasks.createdAt));
  },

  async findByUserId(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  },

  async create(task: InsertTask): Promise<Task> {
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  },

  async toggleComplete(id: string): Promise<Task | undefined> {
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!existing) return undefined;
    const [result] = await db
      .update(tasks)
      .set({
        completed: !existing.completed,
        completedAt: !existing.completed ? new Date() : null,
      })
      .where(eq(tasks.id, id))
      .returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  },

  async checkAndNotifyDueTasks(): Promise<void> {
    const now = new Date();
    const dueTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.completed, false),
          eq(tasks.notified, false),
          lte(tasks.dueDate, now)
        )
      );

    for (const task of dueTasks) {
      await db.insert(notifications).values({
        userId: task.userId,
        type: "task_due",
        title: "Task Due",
        message: `Task "${task.title}" is now due.`,
        link: entityLink(task.entityType, task.entityId),
      });
      await db.update(tasks).set({ notified: true }).where(eq(tasks.id, task.id));
    }
  },
};
