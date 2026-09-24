import { db } from "../../config/database";
import { tickets, clientTable, user, ticketLikes, type Ticket, type InsertTicket } from "@shared/schema";
import { and, desc, eq, lt, not, sql, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Scope } from "../../utils/scope";
import type { TicketWithLikes } from "./ticket.types";

const assignedUser = alias(user, "assigned_user");

export type TicketWithNames = TicketWithLikes;

/** Which slice of their scope a caller wants back from `findAll`. */
export type TicketListMode = "mine" | "raised" | "all";

/**
 * What the caller is trying to do — the security boundary below is stricter
 * for `delete` than for `read`/`update`.
 */
type TicketScopeOp = "read" | "update" | "delete";

// The security boundary: what an agent/homeworker may see, or act on, at all,
// regardless of which `TicketListMode` a list query later narrows to.
//
// read/update: tickets they raised OR were assigned — NOT just tickets they
// raised. Using creator alone here made a ticket assigned to someone else by
// a colleague invisible to the assignee (404 on the detail page, absent from
// every list/badge) and unreplyable/unreassignable by them, since this same
// function also gates findById/findByClientId/findByAssignedTo/update.
//
// delete: creator-only, same as before this fix. Widening delete the same
// way as read/update would hand an assignee (who may not have raised the
// ticket) the right to delete someone else's ticket — a different, higher-
// stakes boundary than "can view/reply/reassign".
function buildTicketScopeConds(scope?: Scope, op: TicketScopeOp = "read"): SQL[] {
  const conds: SQL[] = [];
  if (!scope || scope.orgRole === "platform_admin") return conds;
  conds.push(eq(tickets.orgId, scope.orgId));
  if (scope.orgRole === "branch_manager" && scope.branchId) {
    conds.push(eq(tickets.branchId, scope.branchId));
  }
  if ((scope.orgRole === "agent" || scope.orgRole === "homeworker") && scope.userId) {
    conds.push(
      op === "delete"
        ? eq(tickets.userId, scope.userId)
        : or(eq(tickets.assignedTo, scope.userId), eq(tickets.userId, scope.userId))!,
    );
  }
  return conds;
}

function buildTicketWithNamesQuery(viewerUserId: string | null) {
  return db
    .select({
      id: tickets.id,
      clientId: tickets.clientId,
      userId: tickets.userId,
      assignedTo: tickets.assignedTo,
      transactionId: tickets.transactionId,
      type: tickets.type,
      status: tickets.status,
      priority: tickets.priority,
      subject: tickets.subject,
      description: tickets.description,
      dueDate: tickets.dueDate,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
      resolvedAt: tickets.resolvedAt,
      orgId: tickets.orgId,
      branchId: tickets.branchId,
      clientName: sql<string | null>`COALESCE(NULLIF(${clientTable.title}, 'NULL') || ' ', '') || ${clientTable.firstName} || ' ' || ${clientTable.surename}`.as("client_name"),
      userName: user.name,
      assignedToName: sql<string | null>`${assignedUser.name}`.as("assigned_to_name"),
      replyCount: sql<number>`(SELECT COUNT(*)::int FROM ticket_replies WHERE ticket_replies.ticket_id = ${tickets.id})`.as("reply_count"),
      likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${ticketLikes} WHERE ${ticketLikes.ticketId} = ${tickets.id})`.as("like_count"),
      likedByMe: viewerUserId
        ? sql<boolean>`EXISTS (SELECT 1 FROM ${ticketLikes} WHERE ${ticketLikes.ticketId} = ${tickets.id} AND ${ticketLikes.userId} = ${viewerUserId})`.mapWith(Boolean)
        : sql<boolean>`false`.mapWith(Boolean),
    })
    .from(tickets)
    .leftJoin(clientTable, eq(tickets.clientId, clientTable.id))
    .leftJoin(user, eq(tickets.userId, user.id))
    .leftJoin(assignedUser, eq(tickets.assignedTo, assignedUser.id));
}

export const ticketRepository = {
  async findById(id: string, scope?: Scope, viewerUserId: string | null = null): Promise<TicketWithNames | undefined> {
    const conds: SQL[] = [eq(tickets.id, id), ...buildTicketScopeConds(scope)];
    const results = await buildTicketWithNamesQuery(viewerUserId).where(and(...conds)).limit(1);
    return results[0];
  },

  async findAll(scope?: Scope, viewerUserId: string | null = null, mode: TicketListMode = "mine"): Promise<TicketWithNames[]> {
    const conds = buildTicketScopeConds(scope);
    // Narrows the security boundary above down to the requested view.
    //
    // "mine" fetches the same candidate set findByAssignedTo uses (assigned to
    // me OR raised by me) — the client then applies the shared isMyTicket()
    // predicate (features/tickets/lib/ticket-filters.ts) to match the sidebar
    // badge's definition exactly, rather than this query re-deriving a
    // second, divergent notion of "mine" in SQL.
    //
    // "all" adds nothing further (the service only allows it for admin-tier
    // roles, for whom the boundary above is already org/branch-wide with no
    // personal restriction — agent/homeworker can't reach "all" at all).
    //
    // A personal mode ("mine"/"raised") with no userId to key off — should
    // never happen once auth has run — fails CLOSED (no rows) rather than
    // silently degrading to the full org/branch list.
    if (mode === "mine" || mode === "raised") {
      if (!scope?.userId) {
        conds.push(sql`false`);
      } else if (mode === "mine") {
        conds.push(or(eq(tickets.assignedTo, scope.userId), eq(tickets.userId, scope.userId))!);
      } else {
        conds.push(eq(tickets.userId, scope.userId));
      }
    }
    const query = buildTicketWithNamesQuery(viewerUserId);
    return conds.length > 0
      ? await query.where(and(...conds)).orderBy(desc(tickets.createdAt))
      : await query.orderBy(desc(tickets.createdAt));
  },

  async findByClientId(clientId: string, scope?: Scope, viewerUserId: string | null = null): Promise<TicketWithNames[]> {
    const conds: SQL[] = [eq(tickets.clientId, clientId), ...buildTicketScopeConds(scope)];
    return await buildTicketWithNamesQuery(viewerUserId).where(and(...conds)).orderBy(desc(tickets.createdAt));
  },

  async findByUserId(userId: string, scope?: Scope, viewerUserId: string | null = null): Promise<TicketWithNames[]> {
    const conds: SQL[] = [eq(tickets.userId, userId), ...buildTicketScopeConds(scope)];
    return await buildTicketWithNamesQuery(viewerUserId).where(and(...conds)).orderBy(desc(tickets.createdAt));
  },

  async findByAssignedTo(
    userId: string,
    scope?: Scope,
    filters?: { statuses?: string[]; assignedOnly?: boolean },
    viewerUserId: string | null = null,
  ): Promise<TicketWithNames[]> {
    const scopeConds = buildTicketScopeConds(scope);
    // Default: creator-or-assignee, matching the shared client-side isMyTicket()
    // definition used by the sidebar badge / "what's on" widget. Callers that
    // want strictly "assigned to this person" (e.g. the dashboard's personal
    // ticket panel, which must not surface tickets the user merely raised for
    // someone else) opt in via `assignedOnly` rather than this changing for
    // every existing caller of this endpoint.
    const ownerCond = filters?.assignedOnly
      ? eq(tickets.assignedTo, userId)
      : or(eq(tickets.assignedTo, userId), eq(tickets.userId, userId))!;
    const conds: SQL[] = [ownerCond, ...scopeConds];
    if (filters?.statuses && filters.statuses.length > 0) {
      const lowered = filters.statuses.map((s) => s.toLowerCase().replace("_", " "));
      conds.push(sql`LOWER(REPLACE(${tickets.status}::text, '_', ' ')) IN (${sql.join(lowered.map((s) => sql`${s}`), sql`, `)})`);
    }
    return await buildTicketWithNamesQuery(viewerUserId).where(and(...conds)).orderBy(desc(tickets.createdAt));
  },

  async create(ticket: InsertTicket, scope?: Scope): Promise<Ticket> {
    const values: InsertTicket = scope
      ? ({ ...ticket, orgId: (ticket as any).orgId ?? scope.orgId ?? null, branchId: (ticket as any).branchId ?? scope.branchId ?? null } as InsertTicket)
      : ticket;
    const [result] = await db.insert(tickets).values(values).returning();
    return result;
  },

  async update(id: string, ticket: Partial<InsertTicket>, scope?: Scope): Promise<Ticket | undefined> {
    const conds: SQL[] = [eq(tickets.id, id), ...buildTicketScopeConds(scope, "update")];
    const [result] = await db.update(tickets).set({ ...ticket, updatedAt: new Date() }).where(and(...conds)).returning();
    return result;
  },

  async remove(id: string, scope?: Scope): Promise<boolean> {
    const conds: SQL[] = [eq(tickets.id, id), ...buildTicketScopeConds(scope, "delete")];
    const result = await db.delete(tickets).where(and(...conds)).returning({ id: tickets.id });
    return result.length > 0;
  },

  /**
   * Flip the user's like. Delete-first then insert-on-conflict-do-nothing is
   * branchless, so two concurrent toggles from the same user can't both
   * insert and trip the unique constraint; the count is read in the same
   * transaction so it matches the returned `liked`.
   */
  async toggleLike(ticketId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    return db.transaction(async (tx) => {
      const deleted = await tx
        .delete(ticketLikes)
        .where(and(eq(ticketLikes.ticketId, ticketId), eq(ticketLikes.userId, userId)))
        .returning({ id: ticketLikes.id });

      let liked = false;
      if (deleted.length === 0) {
        const inserted = await tx
          .insert(ticketLikes)
          .values({ ticketId, userId })
          .onConflictDoNothing()
          .returning({ id: ticketLikes.id });
        liked = inserted.length > 0;
      }

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(ticketLikes)
        .where(eq(ticketLikes.ticketId, ticketId));

      return { liked, likeCount: count };
    });
  },

  /**
   * Find tickets that are still open (not Closed/Resolved) and haven't been
   * touched since `cutoff`. Used by the stale-ticket reminder check.
   *
   * `userId`, when provided, scopes the scan to tickets owned by that user —
   * used by the on-demand notification-load trigger so each request only
   * pays for a cheap, indexed per-user query instead of a full table scan.
   */
  async findStale(cutoff: Date, userId?: string) {
    const conds: SQL[] = [
      not(eq(tickets.status, "Closed")),
      not(eq(tickets.status, "Resolved")),
      lt(tickets.updatedAt, cutoff),
    ];
    if (userId) {
      conds.push(eq(tickets.userId, userId));
    }
    return db
      .select({
        id: tickets.id,
        userId: tickets.userId,
        subject: tickets.subject,
        status: tickets.status,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .where(and(...conds));
  },
};
