import { db } from "../../config/database";
import { tasks, notifications, quote, booking, enquiry_table, transaction, clientTable } from "@shared/schema";
import { eq, and, desc, gte, lte, inArray, type SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Scope } from "../../utils/scope";

type TaskNew = typeof tasks.$inferSelect;
type InsertTaskNew = typeof tasks.$inferInsert;

function buildTaskScopeConds(scope?: Scope, opts?: { entityScoped?: boolean }): SQL[] {
  const conds: SQL[] = [];
  if (!scope || scope.orgRole === "platform_admin") return conds;
  conds.push(eq(tasks.orgId, scope.orgId));
  if (scope.orgRole === "branch_manager" && scope.branchId) {
    conds.push(eq(tasks.branchId, scope.branchId));
  }
  // For entity-scoped reads (a single quote/enquiry/booking's task list) we
  // deliberately skip the per-assignee restriction: anyone who can open the
  // record should see ALL of its tasks (org/branch scoped), not only the ones
  // assigned to them. Otherwise a task assigned to the record owner is hidden
  // from an agent who just created it. List/dashboard reads keep the filter.
  if (
    !opts?.entityScoped &&
    (scope.orgRole === "agent" || scope.orgRole === "homeworker") &&
    scope.userId
  ) {
    conds.push(eq(tasks.userId, scope.userId));
  }
  return conds;
}

const entityRouteMap: Record<string, string> = {
  enquiry: "/enquiries",
  quote: "/quotes",
  booking: "/bookings",
};

function entityLink(entityType: string, entityId: string): string {
  const base = entityRouteMap[entityType] ?? `/${entityType}s`;
  return `${base}/${entityId}`;
}

export type TaskWithClient = TaskNew & {
  clientId: string | null;
  clientName: string | null;
  tags: string[];
  entityTitle: string | null;
  entityPrice: string | null;
  entityCommission: string | null;
  entityTravelDate: string | null;
};

async function resolveTaskClients(
  allTasks: TaskNew[],
  quoteEntityIds: string[],
  bookingEntityIds: string[],
  enquiryEntityIds: string[],
  clientEntityIds: string[]
) {
  const transactionIdMap = new Map<string, string>();
  const directClientMap = new Map<string, string>();
  // Maps each task key (`${type}:${entityId}`) to the canonical entity PK to
  // navigate to. entityId is usually the entity's own id, but some tasks store
  // the transaction id instead — resolve those to the real quote/booking/
  // enquiry id so the entity page can load it.
  const navIdMap = new Map<string, string>();
  // Maps each task key to the linked entity's title / price / commission so task
  // rows can show context (quote title, total price, commission).
  type EntityMeta = { title: string | null; price: string | null; commission: string | null; travelDate: string | null };
  const entityMetaMap = new Map<string, EntityMeta>();

  if (quoteEntityIds.length > 0) {
    const quoteRows = await db
      .select({ id: quote.id, transaction_id: quote.transaction_id, title: quote.title, price: quote.sales_price, commission: quote.package_commission, travelDate: quote.travel_date })
      .from(quote)
      .where(inArray(quote.id, quoteEntityIds));
    for (const q of quoteRows) {
      transactionIdMap.set(`quote:${q.id}`, q.transaction_id);
      navIdMap.set(`quote:${q.id}`, q.id);
      entityMetaMap.set(`quote:${q.id}`, { title: q.title, price: q.price, commission: q.commission, travelDate: q.travelDate });
    }
    // entityIds that aren't quote PKs may be transaction ids — resolve each to
    // its main (non-copy, non-free) quote so navigation lands on a real quote.
    const unresolvedIds = quoteEntityIds.filter(id => !quoteRows.some(q => q.id === id));
    if (unresolvedIds.length > 0) {
      const quotesByTx = await db
        .select({ id: quote.id, transaction_id: quote.transaction_id, isQuoteCopy: quote.isQuoteCopy, isFreeQuote: quote.isFreeQuote, title: quote.title, price: quote.sales_price, commission: quote.package_commission, travelDate: quote.travel_date })
        .from(quote)
        .where(inArray(quote.transaction_id, unresolvedIds));
      const mainByTx = new Map<string, { id: string; isQuoteCopy: boolean | null; meta: EntityMeta }>();
      for (const q of quotesByTx) {
        if (q.isFreeQuote) continue;
        const existing = mainByTx.get(q.transaction_id);
        if (!existing || (existing.isQuoteCopy && !q.isQuoteCopy)) {
          mainByTx.set(q.transaction_id, { id: q.id, isQuoteCopy: q.isQuoteCopy, meta: { title: q.title, price: q.price, commission: q.commission, travelDate: q.travelDate } });
        }
      }
      for (const [txId, main] of Array.from(mainByTx.entries())) {
        transactionIdMap.set(`quote:${txId}`, txId);
        navIdMap.set(`quote:${txId}`, main.id);
        entityMetaMap.set(`quote:${txId}`, main.meta);
      }
      // Transaction ids with no quote — still resolve the client link.
      const stillUnresolved = unresolvedIds.filter(id => !mainByTx.has(id));
      if (stillUnresolved.length > 0) {
        const txDirect = await db
          .select({ id: transaction.id })
          .from(transaction)
          .where(inArray(transaction.id, stillUnresolved));
        for (const tx of txDirect) {
          transactionIdMap.set(`quote:${tx.id}`, tx.id);
        }
      }
    }
  }

  if (bookingEntityIds.length > 0) {
    const bookingRows = await db
      .select({ id: booking.id, transaction_id: booking.transaction_id, title: booking.title, price: booking.sales_price, commission: booking.package_commission, travelDate: booking.travel_date })
      .from(booking)
      .where(inArray(booking.id, bookingEntityIds));
    for (const b of bookingRows) {
      transactionIdMap.set(`booking:${b.id}`, b.transaction_id);
      navIdMap.set(`booking:${b.id}`, b.id);
      entityMetaMap.set(`booking:${b.id}`, { title: b.title, price: b.price, commission: b.commission, travelDate: b.travelDate });
    }
    const unresolvedIds = bookingEntityIds.filter(id => !bookingRows.some(b => b.id === id));
    if (unresolvedIds.length > 0) {
      const bookingsByTx = await db
        .select({ id: booking.id, transaction_id: booking.transaction_id, title: booking.title, price: booking.sales_price, commission: booking.package_commission, travelDate: booking.travel_date })
        .from(booking)
        .where(inArray(booking.transaction_id, unresolvedIds));
      for (const b of bookingsByTx) {
        if (!b.transaction_id) continue;
        transactionIdMap.set(`booking:${b.transaction_id}`, b.transaction_id);
        navIdMap.set(`booking:${b.transaction_id}`, b.id);
        entityMetaMap.set(`booking:${b.transaction_id}`, { title: b.title, price: b.price, commission: b.commission, travelDate: b.travelDate });
      }
      const stillUnresolved = unresolvedIds.filter(id => !bookingsByTx.some(b => b.transaction_id === id));
      if (stillUnresolved.length > 0) {
        const txDirect = await db
          .select({ id: transaction.id })
          .from(transaction)
          .where(inArray(transaction.id, stillUnresolved));
        for (const tx of txDirect) {
          transactionIdMap.set(`booking:${tx.id}`, tx.id);
        }
      }
    }
  }

  if (enquiryEntityIds.length > 0) {
    const enquiryRows = await db
      .select({ id: enquiry_table.id, transaction_id: enquiry_table.transaction_id, title: enquiry_table.title, price: enquiry_table.budget, travelDate: enquiry_table.travel_date })
      .from(enquiry_table)
      .where(inArray(enquiry_table.id, enquiryEntityIds));
    for (const e of enquiryRows) {
      transactionIdMap.set(`enquiry:${e.id}`, e.transaction_id);
      navIdMap.set(`enquiry:${e.id}`, e.id);
      entityMetaMap.set(`enquiry:${e.id}`, { title: e.title, price: e.price, commission: null, travelDate: e.travelDate });
    }
    const unresolvedIds = enquiryEntityIds.filter(id => !enquiryRows.some(e => e.id === id));
    if (unresolvedIds.length > 0) {
      const enquiriesByTx = await db
        .select({ id: enquiry_table.id, transaction_id: enquiry_table.transaction_id, title: enquiry_table.title, price: enquiry_table.budget, travelDate: enquiry_table.travel_date })
        .from(enquiry_table)
        .where(inArray(enquiry_table.transaction_id, unresolvedIds));
      for (const e of enquiriesByTx) {
        transactionIdMap.set(`enquiry:${e.transaction_id}`, e.transaction_id);
        navIdMap.set(`enquiry:${e.transaction_id}`, e.id);
        entityMetaMap.set(`enquiry:${e.transaction_id}`, { title: e.title, price: e.price, commission: null, travelDate: e.travelDate });
      }
      const stillUnresolved = unresolvedIds.filter(id => !enquiriesByTx.some(e => e.transaction_id === id));
      if (stillUnresolved.length > 0) {
        const txDirect = await db
          .select({ id: transaction.id })
          .from(transaction)
          .where(inArray(transaction.id, stillUnresolved));
        for (const tx of txDirect) {
          transactionIdMap.set(`enquiry:${tx.id}`, tx.id);
        }
      }
    }
  }

  for (const clientId of clientEntityIds) {
    directClientMap.set(`client:${clientId}`, clientId);
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

  const txClientMap = new Map<string, string>();
  for (const [key, txId] of transactionIdMap.entries()) {
    const cid = clientIdMap.get(txId);
    if (cid) txClientMap.set(key, cid);
  }

  const allClientIds = new Set([
    ...Array.from(clientIdMap.values()),
    ...Array.from(directClientMap.values())
  ]);
  const clientNameMap = new Map<string, string>();

  if (allClientIds.size > 0) {
    const clientRows = await db
      .select({ id: clientTable.id, firstName: clientTable.firstName, surename: clientTable.surename })
      .from(clientTable)
      .where(inArray(clientTable.id, Array.from(allClientIds)));
    for (const c of clientRows) {
      clientNameMap.set(c.id, [c.firstName, c.surename].filter(Boolean).join(" "));
    }
  }

  return { directClientMap, txClientMap, clientNameMap, navIdMap, entityMetaMap };
}

export const taskRepository = {
  async findAll(userId?: string, scope?: Scope): Promise<TaskWithClient[]> {
    const scopeConds = buildTaskScopeConds(scope);
    const conds: SQL[] = userId ? [eq(tasks.userId, userId), ...scopeConds] : scopeConds;
    const query = db.select().from(tasks);
    const allTasks = conds.length > 0
      ? await query.where(and(...conds)).orderBy(desc(tasks.dueDate))
      : await query.orderBy(desc(tasks.dueDate));

    if (allTasks.length === 0) return [];

    const quoteEntityIds = allTasks
      .filter(t => t.entityType === "quote")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);
    const bookingEntityIds = allTasks
      .filter(t => t.entityType === "booking")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);
    const enquiryEntityIds = allTasks
      .filter(t => t.entityType === "enquiry")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);

    const resolvedData = await resolveTaskClients(allTasks, quoteEntityIds, bookingEntityIds, enquiryEntityIds, []);
    return allTasks.map(t => {
      const key = `${t.entityType ?? ""}:${t.entityId ?? ""}`;
      const clientId = resolvedData.directClientMap.get(key) ?? resolvedData.txClientMap.get(key) ?? null;
      const clientName = clientId ? resolvedData.clientNameMap.get(clientId) ?? null : null;
      const entityId = resolvedData.navIdMap.get(key) ?? t.entityId;
      const meta = resolvedData.entityMetaMap.get(key);
      return {
        ...t,
        entityId,
        clientId,
        clientName,
        tags: [t.entityType ?? ""].filter(Boolean),
        entityTitle: meta?.title ?? null,
        entityPrice: meta?.price ?? null,
        entityCommission: meta?.commission ?? null,
        entityTravelDate: meta?.travelDate ?? null,
      };
    });
  },

  async findAllWithClientTasks(
    userId?: string,
    scope?: Scope,
    filters?: { dueFrom?: Date; dueTo?: Date; incomplete?: boolean },
  ): Promise<TaskWithClient[]> {
    const scopeConds = buildTaskScopeConds(scope);
    const conds: SQL[] = userId ? [eq(tasks.userId, userId), ...scopeConds] : scopeConds;
    if (filters?.dueFrom) conds.push(gte(tasks.dueDate, filters.dueFrom));
    if (filters?.dueTo) conds.push(lte(tasks.dueDate, filters.dueTo));
    if (filters?.incomplete) conds.push(eq(tasks.completed, false));
    const query = db.select().from(tasks);
    const allTasks = conds.length > 0
      ? await query.where(and(...conds)).orderBy(desc(tasks.dueDate))
      : await query.orderBy(desc(tasks.dueDate));

    if (allTasks.length === 0) return [];

    // Build excluded keys for on_booking transactions and LOST quotes
    const excludedEntityKeys = new Set<string>();

    const quoteIds = allTasks
      .filter(t => t.entityType === "quote")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);

    if (quoteIds.length > 0) {
      const quoteRows = await db
        .select({ id: quote.id, quote_status: quote.quote_status, transaction_id: quote.transaction_id })
        .from(quote)
        .where(inArray(quote.id, quoteIds));

      const txIds = quoteRows.map(q => q.transaction_id).filter((id): id is string => id !== null);
      const txStatusMap = new Map<string, string>();

      if (txIds.length > 0) {
        const txRows = await db
          .select({ id: transaction.id, status: transaction.status })
          .from(transaction)
          .where(inArray(transaction.id, txIds));
        for (const tx of txRows) {
          if (tx.status) txStatusMap.set(tx.id, tx.status);
        }
      }

      for (const q of quoteRows) {
        if (
          q.quote_status === "LOST" ||
          (q.transaction_id && txStatusMap.get(q.transaction_id) === "on_booking")
        ) {
          excludedEntityKeys.add(`quote:${q.id}`);
        }
      }
    }

    const enquiryIds = allTasks
      .filter(t => t.entityType === "enquiry")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);

    if (enquiryIds.length > 0) {
      const enquiryRows = await db
        .select({ id: enquiry_table.id, transaction_id: enquiry_table.transaction_id })
        .from(enquiry_table)
        .where(inArray(enquiry_table.id, enquiryIds));

      const txIds = enquiryRows.map(e => e.transaction_id).filter((id): id is string => id !== null);

      if (txIds.length > 0) {
        const txRows = await db
          .select({ id: transaction.id, status: transaction.status })
          .from(transaction)
          .where(inArray(transaction.id, txIds));
        const txStatusMap = new Map<string, string>();
        for (const tx of txRows) {
          if (tx.status) txStatusMap.set(tx.id, tx.status);
        }
        for (const e of enquiryRows) {
          if (e.transaction_id && txStatusMap.get(e.transaction_id) === "on_booking") {
            excludedEntityKeys.add(`enquiry:${e.id}`);
          }
        }
      }
    }

    // Booking-type tasks are inherently on_booking stage — exclude them too
    for (const t of allTasks) {
      if (t.entityType === "booking" && t.entityId) {
        excludedEntityKeys.add(`booking:${t.entityId}`);
      }
    }

    const activeTasks = excludedEntityKeys.size > 0
      ? allTasks.filter(t => !excludedEntityKeys.has(`${t.entityType ?? ""}:${t.entityId ?? ""}`))
      : allTasks;

    if (activeTasks.length === 0) return [];

    const quoteEntityIds = activeTasks
      .filter(t => t.entityType === "quote")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);
    const bookingEntityIds = activeTasks
      .filter(t => t.entityType === "booking")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);
    const enquiryEntityIds = activeTasks
      .filter(t => t.entityType === "enquiry")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);
    const clientEntityIds = activeTasks
      .filter(t => t.entityType === "client")
      .map(t => t.entityId)
      .filter((id): id is string => id !== null);

    const resolvedData = await resolveTaskClients(activeTasks, quoteEntityIds, bookingEntityIds, enquiryEntityIds, clientEntityIds);

    return activeTasks.map(t => {
      const key = `${t.entityType ?? ""}:${t.entityId ?? ""}`;
      const clientId = resolvedData.directClientMap.get(key) ?? resolvedData.txClientMap.get(key) ?? null;
      const clientName = clientId ? resolvedData.clientNameMap.get(clientId) ?? null : null;
      const entityId = resolvedData.navIdMap.get(key) ?? t.entityId;
      const meta = resolvedData.entityMetaMap.get(key);
      return {
        ...t,
        entityId,
        clientId,
        clientName,
        tags: [t.entityType ?? ""].filter(Boolean),
        entityTitle: meta?.title ?? null,
        entityPrice: meta?.price ?? null,
        entityCommission: meta?.commission ?? null,
        entityTravelDate: meta?.travelDate ?? null,
      };
    });
  },

  async findByEntity(entityType: string, entityId: string, scope?: Scope): Promise<TaskNew[]> {
    const conds: SQL[] = [eq(tasks.entityType, entityType), eq(tasks.entityId, entityId), ...buildTaskScopeConds(scope, { entityScoped: true })];
    return await db
      .select()
      .from(tasks)
      .where(and(...conds))
      .orderBy(desc(tasks.createdAt));
  },

  async findByUserId(userId: string, scope?: Scope): Promise<TaskNew[]> {
    const conds: SQL[] = [eq(tasks.userId, userId), ...buildTaskScopeConds(scope)];
    return await db
      .select()
      .from(tasks)
      .where(and(...conds))
      .orderBy(desc(tasks.createdAt));
  },

  async create(taskData: InsertTaskNew, scope?: Scope): Promise<TaskNew> {
    const values = scope
      ? { ...taskData, id: randomUUID(), orgId: (taskData as any).orgId ?? scope.orgId ?? null, branchId: (taskData as any).branchId ?? scope.branchId ?? null }
      : { ...taskData, id: randomUUID() };
    const [result] = await db.insert(tasks).values(values).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertTaskNew>, scope?: Scope): Promise<TaskNew | undefined> {
    const conds: SQL[] = [eq(tasks.id, id), ...buildTaskScopeConds(scope)];
    const [existing] = await db.select().from(tasks).where(and(...conds)).limit(1);
    if (!existing) return undefined;
    const [result] = await db
      .update(tasks)
      .set(data)
      .where(and(...conds))
      .returning();
    return result;
  },

  async toggleComplete(id: string, scope?: Scope): Promise<TaskNew | undefined> {
    const conds: SQL[] = [eq(tasks.id, id), ...buildTaskScopeConds(scope)];
    const [existing] = await db.select().from(tasks).where(and(...conds)).limit(1);
    if (!existing) return undefined;
    const [result] = await db
      .update(tasks)
      .set({
        completed: !existing.completed,
        completedAt: !existing.completed ? new Date() : null,
      })
      .where(and(...conds))
      .returning();
    return result;
  },

  async remove(id: string, scope?: Scope): Promise<boolean> {
    const conds: SQL[] = [eq(tasks.id, id), ...buildTaskScopeConds(scope)];
    const result = await db.delete(tasks).where(and(...conds)).returning({ id: tasks.id });
    return result.length > 0;
  },

  async completeByEntity(entityType: string, entityId: string): Promise<void> {
    await db
      .update(tasks)
      .set({ completed: true, completedAt: new Date() })
      .where(
        and(
          eq(tasks.entityType, entityType),
          eq(tasks.entityId, entityId),
          eq(tasks.completed, false)
        )
      );
  },

  async reassignByEntity(entityType: string, entityId: string, newUserId: string): Promise<void> {
    await db
      .update(tasks)
      .set({ userId: newUserId })
      .where(
        and(
          eq(tasks.entityType, entityType),
          eq(tasks.entityId, entityId),
          eq(tasks.completed, false)
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
