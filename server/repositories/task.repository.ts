import { db } from "../config/database";
import { tasks, notifications, quote, enquiry_table, transaction, clientTable } from "@shared/schema";
import { eq, and, desc, lte, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

type TaskNew = typeof tasks.$inferSelect;
type InsertTaskNew = typeof tasks.$inferInsert;

const entityRouteMap: Record<string, string> = {
  enquiry: "/enquiries",
  quote: "/quotes",
  booking: "/bookings",
};

function entityLink(entityType: string, entityId: string): string {
  const base = entityRouteMap[entityType] ?? `/${entityType}s`;
  return `${base}/${entityId}`;
}

export type TaskWithClient = TaskNew & { clientId: string | null; clientName: string | null; tags: string[] };

export const taskRepository = {
  async findAll(): Promise<TaskWithClient[]> {
    const allTasks = await db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.dueDate));

    if (allTasks.length === 0) return [];

    const quoteEntityIds = allTasks
      .filter(t => t.entityType === "quote" || t.entityType === "booking")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);
    const enquiryEntityIds = allTasks
      .filter(t => t.entityType === "enquiry")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);

    const transactionIdMap = new Map<string, string>();

    if (quoteEntityIds.length > 0) {
      const quoteRows = await db
        .select({ id: quote.id, transaction_id: quote.transaction_id })
        .from(quote)
        .where(inArray(quote.id, quoteEntityIds));
      for (const q of quoteRows) {
        transactionIdMap.set(`quote:${q.id}`, q.transaction_id);
        transactionIdMap.set(`booking:${q.id}`, q.transaction_id);
      }
    }

    if (enquiryEntityIds.length > 0) {
      const enquiryRows = await db
        .select({ id: enquiry_table.id, transaction_id: enquiry_table.transaction_id })
        .from(enquiry_table)
        .where(inArray(enquiry_table.id, enquiryEntityIds));
      for (const e of enquiryRows) {
        transactionIdMap.set(`enquiry:${e.id}`, e.transaction_id);
      }
    }

    const uniqueTransactionIds = Array.from(new Set(Array.from(transactionIdMap.values())));
    const clientIdMap = new Map<string, string>();

    if (uniqueTransactionIds.length > 0) {
      const txRows = await db
        .select({ id: transaction.id, client_id: transaction.client_id })
        .from(transaction)
        .where(inArray(transaction.id, uniqueTransactionIds));
      for (const tx of txRows) {
        if (tx.client_id) {
          clientIdMap.set(tx.id, tx.client_id);
        }
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
      const key = `${t.entityType ?? ""}:${t.entityId ?? ""}`;
      const txId = transactionIdMap.get(key);
      const cid = txId ? clientIdMap.get(txId) ?? null : null;
      const clientName = cid ? clientNameMap.get(cid) ?? null : null;
      return { ...t, clientId: cid, clientName, tags: [t.entityType ?? ""].filter(Boolean) };
    });
  },

  async findByEntity(entityType: string, entityId: string): Promise<TaskNew[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.entityType, entityType), eq(tasks.entityId, entityId)))
      .orderBy(desc(tasks.createdAt));
  },

  async findByUserId(userId: string): Promise<TaskNew[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  },

  async create(taskData: InsertTaskNew): Promise<TaskNew> {
    const [result] = await db.insert(tasks).values({
      ...taskData,
      id: randomUUID(),
    }).returning();
    return result;
  },

  async toggleComplete(id: string): Promise<TaskNew | undefined> {
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

  async reassignByEntity(entityType: string, entityId: string, newUserId: string): Promise<void> {
    await db
      .update(tasks)
      .set({ userId: newUserId })
      .where(
        and(
          eq(tasks.entityType, entityType),
          eq(tasks.entityId, entityId),
          eq(tasks.completed, false) // Only reassign incomplete tasks
        )
      );
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

    for (const t of dueTasks) {
      if (t.userId) {
        await db.insert(notifications).values({
          userId: t.userId,
          type: "task_due",
          title: "Task Due",
          message: `Task "${t.title}" is now due.`,
          link: entityLink(t.entityType ?? "", t.entityId ?? ""),
        });
      }
      await db.update(tasks).set({ notified: true }).where(eq(tasks.id, t.id));
    }
  },
};
