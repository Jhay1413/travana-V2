import { db } from "../config/database";
import { tasks, notifications, quotes, enquiries, clientTable, type Task, type InsertTask } from "@shared/schema";
import { eq, and, desc, lte, inArray } from "drizzle-orm";

const entityRouteMap: Record<string, string> = {
  enquiry: "/enquiries",
  quote: "/quotes",
  booking: "/bookings",
};

function entityLink(entityType: string, entityId: string): string {
  const base = entityRouteMap[entityType] ?? `/${entityType}s`;
  return `${base}/${entityId}`;
}

export type TaskWithClient = Task & { clientName: string | null; tags: string[] };

export const taskRepository = {
  async findAll(): Promise<TaskWithClient[]> {
    const allTasks = await db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.dueDate));

    if (allTasks.length === 0) return [];

    const quoteEntityIds = allTasks.filter(t => t.entityType === "quote" || t.entityType === "booking").map(t => t.entityId);
    const enquiryEntityIds = allTasks.filter(t => t.entityType === "enquiry").map(t => t.entityId);

    const clientIdMap = new Map<string, string>();

    if (quoteEntityIds.length > 0) {
      const quoteRows = await db
        .select({ id: quotes.id, clientId: quotes.clientId })
        .from(quotes)
        .where(inArray(quotes.id, quoteEntityIds));
      for (const q of quoteRows) {
        clientIdMap.set(`quote:${q.id}`, q.clientId);
        clientIdMap.set(`booking:${q.id}`, q.clientId);
      }
    }

    if (enquiryEntityIds.length > 0) {
      const enquiryRows = await db
        .select({ id: enquiries.id, clientId: enquiries.clientId })
        .from(enquiries)
        .where(inArray(enquiries.id, enquiryEntityIds));
      for (const e of enquiryRows) {
        clientIdMap.set(`enquiry:${e.id}`, e.clientId);
      }
    }

    const uniqueClientIds = Array.from(new Set(Array.from(clientIdMap.values())));
    const clientNameMap = new Map<string, string>();

    if (uniqueClientIds.length > 0) {
      const clientRows = await db
        .select({ id: clientTable.id, firstName: clientTable.firstName, surename: clientTable.surename })
        .from(clientTable)
        .where(inArray(clientTable.id, uniqueClientIds));
      for (const c of clientRows) {
        clientNameMap.set(c.id, [c.firstName, c.surename].filter(Boolean).join(" "));
      }
    }

    return allTasks.map(t => {
      const cid = clientIdMap.get(`${t.entityType}:${t.entityId}`);
      const clientName = cid ? clientNameMap.get(cid) ?? null : null;
      return { ...t, clientName, tags: [t.entityType] };
    });
  },

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
