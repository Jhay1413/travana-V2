import { db } from "../../config/database";
import { tickets, clientTable, user, ticketLikes, type Ticket, type InsertTicket } from "@shared/schema";
import { and, desc, eq, lt, not, sql, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Scope } from "../../utils/scope";
import type { TicketWithLikes } from "./ticket.types";

const assignedUser = alias(user, "assigned_user");

export type TicketWithNames = TicketWithLikes;

function buildTicketScopeConds(scope?: Scope): SQL[] {
  const conds: SQL[] = [];
  if (!scope || scope.orgRole === "platform_admin") return conds;
  conds.push(eq(tickets.orgId, scope.orgId));
  if (scope.orgRole === "branch_manager" && scope.branchId) {
    conds.push(eq(tickets.branchId, scope.branchId));
  }
  if ((scope.orgRole === "agent" || scope.orgRole === "homeworker") && scope.userId) {
    conds.push(eq(tickets.userId, scope.userId));
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
      bookingId: tickets.bookingId,
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

  async findAll(scope?: Scope, viewerUserId: string | null = null): Promise<TicketWithNames[]> {
    const conds = buildTicketScopeConds(scope);
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
    filters?: { statuses?: string[] },
    viewerUserId: string | null = null,
  ): Promise<TicketWithNames[]> {
    const scopeConds = buildTicketScopeConds(scope);
    const assignedOr = or(eq(tickets.assignedTo, userId), eq(tickets.userId, userId))!;
    const conds: SQL[] = [assignedOr, ...scopeConds];
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
    const conds: SQL[] = [eq(tickets.id, id), ...buildTicketScopeConds(scope)];
    const [result] = await db.update(tickets).set({ ...ticket, updatedAt: new Date() }).where(and(...conds)).returning();
    return result;
  },

  async remove(id: string, scope?: Scope): Promise<boolean> {
    const conds: SQL[] = [eq(tickets.id, id), ...buildTicketScopeConds(scope)];
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
   * touched since `cutoff`. Used by the stale-ticket reminder job.
   */
  async findStale(cutoff: Date) {
    return db
      .select({
        id: tickets.id,
        userId: tickets.userId,
        subject: tickets.subject,
        status: tickets.status,
        updatedAt: tickets.updatedAt,
      })
      .from(tickets)
      .where(
        and(
          not(eq(tickets.status, "Closed")),
          not(eq(tickets.status, "Resolved")),
          lt(tickets.updatedAt, cutoff),
        ),
      );
  },
};
