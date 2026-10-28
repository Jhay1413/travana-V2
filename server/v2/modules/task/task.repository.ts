import { db } from "../../config/database";
import { tasks, quote, booking, enquiry_table, transaction, clientTable } from "@shared/schema";
import { eq, and, or, desc, gte, lte, inArray, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Scope } from "../../utils/scope";
import { buildPartitionCond, buildTransactionRecordScopeConds, type ScopeOrTrusted } from "../../utils/scope-conditions";

type TaskNew = typeof tasks.$inferSelect;
// id is generated here (randomUUID), so callers never supply it.
type InsertTaskNew = Omit<typeof tasks.$inferInsert, "id">;

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
  // TRANSITIONAL NULL-branch arm: tasks.branch_id is nullable and legacy rows stay
  // NULL until the Phase 8 migration rewrites it.
  // Entity-scoped reads apply NO task-level partition: the service has already
  // verified access to the entity itself (entityInScope), and everyone who can
  // open the entity sees all of its tasks.
  if (!opts?.entityScoped) {
    const partition = buildPartitionCond(scope, tasks.branchId, tasks.userId, { allowNullBranchForOwner: true });
    if (partition) conds.push(partition);
  }
  return conds;
}

/**
 * Is the task's entity one the caller can open? Same record-level rules as
 * `entityInScope` (deal visibility via the transaction, client visibility via the
 * client row), expressed as SQL so it can sit inside a task WHERE. Deal ids are
 * matched on entity_id alone because booking tasks may be stored as entity_type
 * "quote" with the booking id (see findByClient).
 */
function buildEntityVisibleCond(scope: Scope): SQL {
  const txnWhere = sql.join(buildTransactionRecordScopeConds(scope), sql` AND `);
  const dealIds = (source: typeof quote | typeof booking | typeof enquiry_table) =>
    sql`SELECT ${source.id}::text FROM ${source} INNER JOIN ${transaction} ON ${source.transaction_id} = ${transaction.id} WHERE ${txnWhere}`;
  const clientConds: SQL[] = [eq(clientTable.orgId, scope.orgId)];
  const clientPartition = buildPartitionCond(scope, clientTable.branchId, clientTable.createdBy);
  if (clientPartition) clientConds.push(clientPartition);
  const clientWhere = sql.join(clientConds, sql` AND `);
  return sql`(
    ${tasks.entityId} IN (${dealIds(quote)})
    OR ${tasks.entityId} IN (${dealIds(booking)})
    OR ${tasks.entityId} IN (${dealIds(enquiry_table)})
    OR ${tasks.entityId} IN (SELECT ${transaction.id}::text FROM ${transaction} WHERE ${txnWhere})
    OR (${tasks.entityType} = 'client' AND ${tasks.entityId} IN (SELECT ${clientTable.id}::text FROM ${clientTable} WHERE ${clientWhere}))
  )`;
}

/**
 * Conditions under which the caller may edit / complete / delete / reassign a task:
 * anyone who can SEE the task can change it.
 *  - admins, branch managers, platform admin: exactly the normal task scope
 *    (they are not restricted to their own tasks).
 *  - agent / homeworker: the task is theirs (normal task scope: org + own + partition)
 *    OR its entity is visible to them (org + entity-visible, as the entity-scoped
 *    list shows). Tasks with no entity stay own-task only.
 */
export function taskWritableConds(scope?: Scope): SQL[] {
  const own = buildTaskScopeConds(scope);
  if (!scope || (scope.orgRole !== "agent" && scope.orgRole !== "homeworker")) return own;
  const viaEntity = [...buildTaskScopeConds(scope, { entityScoped: true }), buildEntityVisibleCond(scope)];
  const either = or(and(...own), and(...viaEntity));
  return either ? [either] : own;
}

const entityRouteMap: Record<string, string> = {
  enquiry: "/enquiries",
  quote: "/quotes",
  booking: "/bookings",
};

export function entityLink(entityType: string, entityId: string): string {
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
  type EntityMeta = { title: string | null; price: string | null; commission: string | null; travelDate: string | null };

  // Each resolver returns partial maps keyed with a namespaced prefix so they
  // can be merged without conflict after parallel resolution.
  type PartialResolution = {
    transactionEntries: Array<[string, string]>;
    navEntries: Array<[string, string]>;
    metaEntries: Array<[string, EntityMeta]>;
  };

  async function resolveQuotes(): Promise<PartialResolution> {
    const result: PartialResolution = { transactionEntries: [], navEntries: [], metaEntries: [] };
    if (quoteEntityIds.length === 0) return result;

    const quoteRows = await db
      .select({ id: quote.id, transaction_id: quote.transaction_id, title: quote.title, price: quote.sales_price, commission: quote.package_commission, travelDate: quote.travel_date })
      .from(quote)
      .where(inArray(quote.id, quoteEntityIds));
    for (const q of quoteRows) {
      result.transactionEntries.push([`quote:${q.id}`, q.transaction_id]);
      result.navEntries.push([`quote:${q.id}`, q.id]);
      result.metaEntries.push([`quote:${q.id}`, { title: q.title, price: q.price, commission: q.commission, travelDate: q.travelDate }]);
    }
    // entityIds that aren't quote PKs may be transaction ids — resolve each to
    // its main (non-copy, non-free) quote so navigation lands on a real quote.
    const resolvedQuoteIds = new Set(quoteRows.map(q => q.id));
    const unresolvedIds = quoteEntityIds.filter(id => !resolvedQuoteIds.has(id));
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
        result.transactionEntries.push([`quote:${txId}`, txId]);
        result.navEntries.push([`quote:${txId}`, main.id]);
        result.metaEntries.push([`quote:${txId}`, main.meta]);
      }
      // Transaction ids with no quote — still resolve the client link.
      const stillUnresolved = unresolvedIds.filter(id => !mainByTx.has(id));
      if (stillUnresolved.length > 0) {
        const txDirect = await db
          .select({ id: transaction.id })
          .from(transaction)
          .where(inArray(transaction.id, stillUnresolved));
        for (const tx of txDirect) {
          result.transactionEntries.push([`quote:${tx.id}`, tx.id]);
        }
      }
    }
    return result;
  }

  async function resolveBookings(): Promise<PartialResolution> {
    const result: PartialResolution = { transactionEntries: [], navEntries: [], metaEntries: [] };
    if (bookingEntityIds.length === 0) return result;

    const bookingRows = await db
      .select({ id: booking.id, transaction_id: booking.transaction_id, title: booking.title, price: booking.sales_price, commission: booking.package_commission, travelDate: booking.travel_date })
      .from(booking)
      .where(inArray(booking.id, bookingEntityIds));
    for (const b of bookingRows) {
      result.transactionEntries.push([`booking:${b.id}`, b.transaction_id]);
      result.navEntries.push([`booking:${b.id}`, b.id]);
      result.metaEntries.push([`booking:${b.id}`, { title: b.title, price: b.price, commission: b.commission, travelDate: b.travelDate }]);
    }
    const resolvedBookingIds = new Set(bookingRows.map(b => b.id));
    const unresolvedIds = bookingEntityIds.filter(id => !resolvedBookingIds.has(id));
    if (unresolvedIds.length > 0) {
      const bookingsByTx = await db
        .select({ id: booking.id, transaction_id: booking.transaction_id, title: booking.title, price: booking.sales_price, commission: booking.package_commission, travelDate: booking.travel_date })
        .from(booking)
        .where(inArray(booking.transaction_id, unresolvedIds));
      for (const b of bookingsByTx) {
        if (!b.transaction_id) continue;
        result.transactionEntries.push([`booking:${b.transaction_id}`, b.transaction_id]);
        result.navEntries.push([`booking:${b.transaction_id}`, b.id]);
        result.metaEntries.push([`booking:${b.transaction_id}`, { title: b.title, price: b.price, commission: b.commission, travelDate: b.travelDate }]);
      }
      const resolvedByTxIds = new Set(bookingsByTx.map(b => b.transaction_id).filter((id): id is string => id !== null));
      const stillUnresolved = unresolvedIds.filter(id => !resolvedByTxIds.has(id));
      if (stillUnresolved.length > 0) {
        const txDirect = await db
          .select({ id: transaction.id })
          .from(transaction)
          .where(inArray(transaction.id, stillUnresolved));
        for (const tx of txDirect) {
          result.transactionEntries.push([`booking:${tx.id}`, tx.id]);
        }
      }
    }
    return result;
  }

  async function resolveEnquiries(): Promise<PartialResolution> {
    const result: PartialResolution = { transactionEntries: [], navEntries: [], metaEntries: [] };
    if (enquiryEntityIds.length === 0) return result;

    const enquiryRows = await db
      .select({ id: enquiry_table.id, transaction_id: enquiry_table.transaction_id, title: enquiry_table.title, price: enquiry_table.budget, travelDate: enquiry_table.travel_date })
      .from(enquiry_table)
      .where(inArray(enquiry_table.id, enquiryEntityIds));
    for (const e of enquiryRows) {
      result.transactionEntries.push([`enquiry:${e.id}`, e.transaction_id]);
      result.navEntries.push([`enquiry:${e.id}`, e.id]);
      result.metaEntries.push([`enquiry:${e.id}`, { title: e.title, price: e.price, commission: null, travelDate: e.travelDate }]);
    }
    const resolvedEnquiryIds = new Set(enquiryRows.map(e => e.id));
    const unresolvedIds = enquiryEntityIds.filter(id => !resolvedEnquiryIds.has(id));
    if (unresolvedIds.length > 0) {
      const enquiriesByTx = await db
        .select({ id: enquiry_table.id, transaction_id: enquiry_table.transaction_id, title: enquiry_table.title, price: enquiry_table.budget, travelDate: enquiry_table.travel_date })
        .from(enquiry_table)
        .where(inArray(enquiry_table.transaction_id, unresolvedIds));
      for (const e of enquiriesByTx) {
        result.transactionEntries.push([`enquiry:${e.transaction_id}`, e.transaction_id]);
        result.navEntries.push([`enquiry:${e.transaction_id}`, e.id]);
        result.metaEntries.push([`enquiry:${e.transaction_id}`, { title: e.title, price: e.price, commission: null, travelDate: e.travelDate }]);
      }
      const resolvedByEnquiryTxIds = new Set(enquiriesByTx.map(e => e.transaction_id).filter((id): id is string => id !== null));
      const stillUnresolved = unresolvedIds.filter(id => !resolvedByEnquiryTxIds.has(id));
      if (stillUnresolved.length > 0) {
        const txDirect = await db
          .select({ id: transaction.id })
          .from(transaction)
          .where(inArray(transaction.id, stillUnresolved));
        for (const tx of txDirect) {
          result.transactionEntries.push([`enquiry:${tx.id}`, tx.id]);
        }
      }
    }
    return result;
  }

  // Resolve all three entity types concurrently — their DB reads are independent.
  const [quoteResolution, bookingResolution, enquiryResolution] = await Promise.all([
    resolveQuotes(),
    resolveBookings(),
    resolveEnquiries(),
  ]);

  const transactionIdMap = new Map<string, string>();
  const navIdMap = new Map<string, string>();
  const entityMetaMap = new Map<string, EntityMeta>();

  for (const [k, v] of [...quoteResolution.transactionEntries, ...bookingResolution.transactionEntries, ...enquiryResolution.transactionEntries]) {
    transactionIdMap.set(k, v);
  }
  for (const [k, v] of [...quoteResolution.navEntries, ...bookingResolution.navEntries, ...enquiryResolution.navEntries]) {
    navIdMap.set(k, v);
  }
  for (const [k, v] of [...quoteResolution.metaEntries, ...bookingResolution.metaEntries, ...enquiryResolution.metaEntries]) {
    entityMetaMap.set(k, v);
  }

  const directClientMap = new Map<string, string>();
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
          q.quote_status === "lost" ||
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

  /**
   * Can the caller open this entity (quote / enquiry / booking / transaction /
   * client)? Uses the same partitioned record-level conditions as the entity's
   * own detail page. Unknown entity types are not in scope.
   */
  async entityInScope(entityType: string, entityId: string, scope: ScopeOrTrusted): Promise<boolean> {
    if (entityType === "client") {
      const s = scope as Scope;
      const conds: SQL[] = [eq(clientTable.id, entityId)];
      if (scope.orgId !== null && s.orgRole !== "platform_admin") conds.push(eq(clientTable.orgId, s.orgId));
      const partition = buildPartitionCond(scope, clientTable.branchId, clientTable.createdBy);
      if (partition) conds.push(partition);
      const [row] = await db.select({ id: clientTable.id }).from(clientTable).where(and(...conds)).limit(1);
      return !!row;
    }
    const txnConds = buildTransactionRecordScopeConds(scope);
    if (entityType === "transaction") {
      const [row] = await db.select({ id: transaction.id }).from(transaction).where(and(eq(transaction.id, entityId), ...txnConds)).limit(1);
      return !!row;
    }
    const source = entityType === "quote" ? quote : entityType === "enquiry" ? enquiry_table : entityType === "booking" ? booking : null;
    if (!source) return false;
    const [row] = await db
      .select({ id: source.id })
      .from(source)
      .innerJoin(transaction, eq(source.transaction_id, transaction.id))
      .where(and(eq(source.id, entityId), ...txnConds))
      .limit(1);
    return !!row;
  },

  async findByEntity(entityType: string, entityId: string, scope?: Scope): Promise<TaskNew[]> {
    const conds: SQL[] = [eq(tasks.entityType, entityType), eq(tasks.entityId, entityId), ...buildTaskScopeConds(scope, { entityScoped: true })];
    return await db
      .select()
      .from(tasks)
      .where(and(...conds))
      .orderBy(desc(tasks.createdAt));
  },

  /**
   * Tasks on the client itself plus tasks on any of its enquiries, quotes and
   * bookings (booking tasks may be stored as entity_type "quote" with the
   * booking id, so the deal ids are matched on entity_id alone). The service
   * has already verified the caller can open the client.
   */
  async findByClient(clientId: string, scope?: Scope): Promise<TaskNew[]> {
    const idsFor = async (source: typeof quote | typeof booking | typeof enquiry_table): Promise<string[]> => {
      const rows = await db
        .select({ id: source.id })
        .from(source)
        .innerJoin(transaction, eq(source.transaction_id, transaction.id))
        .where(and(eq(transaction.client_id, clientId), ...buildTransactionRecordScopeConds(scope ?? { orgId: null })));
      return rows.map((r) => r.id);
    };
    const dealIds = (await Promise.all([idsFor(quote), idsFor(booking), idsFor(enquiry_table)])).flat();
    const clientMatch = and(eq(tasks.entityType, "client"), eq(tasks.entityId, clientId));
    const target = dealIds.length > 0 ? or(clientMatch, inArray(tasks.entityId, dealIds)) : clientMatch;
    return await db
      .select()
      .from(tasks)
      .where(and(target, ...buildTaskScopeConds(scope, { entityScoped: true })))
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

  /**
   * Plain, unresolved task row — used by the service layer to read the prior
   * assignee before an update, so it can tell an actual reassignment apart
   * from a resave that merely echoes back the same `userId`.
   */
  async findById(id: string, scope?: Scope): Promise<TaskNew | undefined> {
    // Write-scope: this feeds the update path, so it must see exactly the tasks update can touch.
    const conds: SQL[] = [eq(tasks.id, id), ...taskWritableConds(scope)];
    const [result] = await db.select().from(tasks).where(and(...conds)).limit(1);
    return result;
  },

  async create(taskData: InsertTaskNew, scope?: Scope): Promise<TaskNew> {
    // orgId always comes from the caller's scope; the service decides branchId.
    const values = scope
      ? { ...taskData, id: randomUUID(), orgId: scope.orgId || null, branchId: taskData.branchId ?? scope.branchId ?? null }
      : { ...taskData, id: randomUUID() };
    const [result] = await db.insert(tasks).values(values).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertTaskNew>, scope?: Scope): Promise<TaskNew | undefined> {
    const conds: SQL[] = [eq(tasks.id, id), ...taskWritableConds(scope)];
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
    const conds: SQL[] = [eq(tasks.id, id), ...taskWritableConds(scope)];
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
    const conds: SQL[] = [eq(tasks.id, id), ...taskWritableConds(scope)];
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

  /**
   * branch_id of the deal (transaction) an entity belongs to — or the client's
   * branch for a client task. null when the entity has no branch or is unknown.
   */
  async findEntityBranchId(entityType: string, entityId: string): Promise<string | null> {
    if (entityType === "client") {
      const [row] = await db.select({ branchId: clientTable.branchId }).from(clientTable).where(eq(clientTable.id, entityId)).limit(1);
      return row?.branchId ?? null;
    }
    if (entityType === "transaction") {
      const [row] = await db.select({ branchId: transaction.branch_id }).from(transaction).where(eq(transaction.id, entityId)).limit(1);
      return row?.branchId ?? null;
    }
    const source = entityType === "quote" ? quote : entityType === "enquiry" ? enquiry_table : entityType === "booking" ? booking : null;
    if (!source) return null;
    const [row] = await db
      .select({ branchId: transaction.branch_id })
      .from(source)
      .innerJoin(transaction, eq(source.transaction_id, transaction.id))
      .where(eq(source.id, entityId))
      .limit(1);
    return row?.branchId ?? null;
  },

  async reassignByEntity(entityType: string, entityId: string, newUserId: string, branchId?: string | null): Promise<void> {
    await db
      .update(tasks)
      .set(branchId ? { userId: newUserId, branchId } : { userId: newUserId })
      .where(
        and(
          eq(tasks.entityType, entityType),
          eq(tasks.entityId, entityId),
          eq(tasks.completed, false)
        )
      );
  },
};
