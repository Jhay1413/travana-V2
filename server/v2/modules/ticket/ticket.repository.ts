import { db } from "../../config/database";
import {
  tickets,
  clientTable,
  user,
  ticketLikes,
  ticketReplies,
  transaction,
  booking,
  quote,
  enquiry_table,
  tour_operator,
  type Ticket,
  type InsertTicket,
} from "@shared/schema";
import { and, desc, eq, inArray, isNull, sql, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Scope } from "../../utils/scope";
import { buildPartitionCond, type ScopeOrTrusted } from "../../utils/scope-conditions";
import type {
  HolidayLinkTarget,
  HolidayQuoteRow,
  HolidayTransactionRow,
  TicketScopeRef,
  TicketWithLikes,
  TicketWriteValues,
} from "./ticket.types";

const assignedUser = alias(user, "assigned_user");
const bookingOperator = alias(tour_operator, "booking_op");
const quoteOperator = alias(tour_operator, "quote_op");

export type TicketWithNames = TicketWithLikes;

/** Which slice of their scope a caller wants back from `findAll`. */
export type TicketListMode = "mine" | "raised" | "all";

/**
 * What the caller is trying to do — the security boundary below is stricter
 * for `delete` than for `read`/`update`.
 */
export type TicketScopeOp = "read" | "update" | "delete";

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
function buildTicketScopeConds(scopeOrTrusted?: ScopeOrTrusted, op: TicketScopeOp = "read"): SQL[] {
  const conds: SQL[] = [];
  // Trusted internal callers ({ orgId: null }) and platform_admin are unrestricted.
  if (!scopeOrTrusted || scopeOrTrusted.orgId === null) return conds;
  const scope = scopeOrTrusted as Scope;
  if (scope.orgRole === "platform_admin") return conds;
  conds.push(eq(tickets.orgId, scope.orgId));
  // FAIL CLOSED: only org_admin (org-wide) and a branch_manager who actually has
  // a branch (org + that branch) see beyond their own tickets. Every other role
  // - agent, homeworker, referral_agent, social_media_manager, a branch_manager
  // with no branch, or anything unknown - is limited to tickets they created or
  // are assigned (creator only for delete).
  const seesBeyondOwn =
    scope.orgRole === "org_admin" || (scope.orgRole === "branch_manager" && !!scope.branchId);
  if (scope.orgRole === "branch_manager" && scope.branchId) {
    conds.push(eq(tickets.branchId, scope.branchId));
  }
  const selfCond =
    scope.userId
      ? op === "delete"
        ? eq(tickets.userId, scope.userId)
        : or(eq(tickets.assignedTo, scope.userId), eq(tickets.userId, scope.userId))!
      : undefined;
  if (!seesBeyondOwn) {
    // No user id to key off: match nothing rather than the whole org.
    conds.push(selfCond ?? sql`false`);
  }
  // The creator-or-assignee condition doubles as the homeworker owner rule. The
  // NULL-branch arm is TRANSITIONAL: legacy tickets keep a NULL branch_id until
  // the Phase 8 migration rewrites it.
  const partition = buildPartitionCond(scope, tickets.branchId, selfCond, { allowNullBranchForOwner: true });
  if (partition) conds.push(partition);
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
      clientPhone: sql<string | null>`NULLIF(${clientTable.phoneNumber}, 'NULL')`.as("client_phone"),
      userName: user.name,
      assignedToName: sql<string | null>`${assignedUser.name}`.as("assigned_to_name"),
      replyCount: sql<number>`(SELECT COUNT(*)::int FROM ticket_replies WHERE ticket_replies.ticket_id = ${tickets.id})`.as("reply_count"),
      likeCount: sql<number>`(SELECT COUNT(*)::int FROM ${ticketLikes} WHERE ${ticketLikes.ticketId} = ${tickets.id})`.as("like_count"),
      lastActivityAt: sql<Date>`GREATEST(${tickets.createdAt}, COALESCE(${tickets.updatedAt}, ${tickets.createdAt}), COALESCE((SELECT MAX(${ticketReplies.createdAt}) FROM ${ticketReplies} WHERE ${ticketReplies.ticketId} = ${tickets.id}), ${tickets.createdAt}))`.mapWith(tickets.createdAt),
      likedByMe: viewerUserId
        ? sql<boolean>`EXISTS (SELECT 1 FROM ${ticketLikes} WHERE ${ticketLikes.ticketId} = ${tickets.id} AND ${ticketLikes.userId} = ${viewerUserId})`.mapWith(Boolean)
        : sql<boolean>`false`.mapWith(Boolean),
    })
    .from(tickets)
    .leftJoin(clientTable, and(eq(tickets.clientId, clientTable.id), eq(clientTable.orgId, tickets.orgId)))
    .leftJoin(user, eq(tickets.userId, user.id))
    .leftJoin(assignedUser, eq(tickets.assignedTo, assignedUser.id));
}

export const ticketRepository = {
  /**
   * The single scope gate for replies / attachments: the ticket, only if the
   * caller may act on it under the same rules as the ticket itself. A trusted
   * caller ({ orgId: null }) or platform_admin is unrestricted.
   */
  async findByIdScoped(id: string, scope?: ScopeOrTrusted, op: TicketScopeOp = "read"): Promise<TicketScopeRef | undefined> {
    const conds: SQL[] = [eq(tickets.id, id), ...buildTicketScopeConds(scope, op)];
    const [result] = await db
      .select({
        id: tickets.id,
        userId: tickets.userId,
        assignedTo: tickets.assignedTo,
        orgId: tickets.orgId,
        branchId: tickets.branchId,
        subject: tickets.subject,
        status: tickets.status,
        resolvedAt: tickets.resolvedAt,
        clientId: tickets.clientId,
        transactionId: tickets.transactionId,
      })
      .from(tickets)
      .where(and(...conds))
      .limit(1);
    return result;
  },

  /** Org of a client, for checking a ticket may be filed against it. */
  async findClientRef(clientId: string): Promise<{ id: string; orgId: string | null } | undefined> {
    const [row] = await db
      .select({ id: clientTable.id, orgId: clientTable.orgId })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);
    return row;
  },

  /** Org + client of a transaction, for validating a ticket -> holiday link. */
  async findHolidayLinkTarget(transactionId: string): Promise<HolidayLinkTarget | undefined> {
    const [row] = await db
      .select({ id: transaction.id, orgId: transaction.org_id, clientId: transaction.client_id })
      .from(transaction)
      .where(eq(transaction.id, transactionId))
      .limit(1);
    return row;
  },

  /**
   * Raw facts for the holiday summary of each transaction: the transaction with
   * its booking and (non-deleted) enquiry, plus its latest primary quote.
   * booking.deleted_at is deliberately NOT filtered — the column defaults to
   * now(), so filtering it would hide every booking.
   */
  async findHolidaySummaries(
    transactionIds: string[],
  ): Promise<{ transactions: HolidayTransactionRow[]; quotes: HolidayQuoteRow[] }> {
    if (transactionIds.length === 0) return { transactions: [], quotes: [] };

    const transactions = await db
      .select({
        transactionId: transaction.id,
        orgId: transaction.org_id,
        clientId: transaction.client_id,
        status: transaction.status,
        bookingId: booking.id,
        bookingTitle: booking.title,
        bookingTravelDate: booking.travel_date,
        bookingNights: booking.num_of_nights,
        haysRef: booking.hays_ref,
        supplierRef: booking.supplier_ref,
        bookingOperatorName: bookingOperator.name,
        bookingOperatorLogoUrl: bookingOperator.logo_url,
        enquiryId: enquiry_table.id,
        enquiryTitle: enquiry_table.title,
        enquiryTravelDate: enquiry_table.travel_date,
        enquiryNights: enquiry_table.no_of_nights,
      })
      .from(transaction)
      .leftJoin(booking, eq(booking.transaction_id, transaction.id))
      .leftJoin(bookingOperator, eq(booking.main_tour_operator_id, bookingOperator.id))
      .leftJoin(enquiry_table, and(eq(enquiry_table.transaction_id, transaction.id), isNull(enquiry_table.deleted_at)))
      .where(inArray(transaction.id, transactionIds));

    const quotes = await db
      .selectDistinctOn([quote.transaction_id], {
        transactionId: quote.transaction_id,
        quoteId: quote.id,
        title: quote.title,
        travelDate: quote.travel_date,
        nights: quote.num_of_nights,
        operatorName: quoteOperator.name,
        operatorLogoUrl: quoteOperator.logo_url,
      })
      .from(quote)
      .leftJoin(quoteOperator, eq(quote.main_tour_operator_id, quoteOperator.id))
      .where(
        and(
          inArray(quote.transaction_id, transactionIds),
          isNull(quote.deleted_at),
          sql`${quote.isQuoteCopy} IS NOT TRUE`,
          sql`${quote.isFreeQuote} IS NOT TRUE`,
        ),
      )
      .orderBy(quote.transaction_id, sql`${quote.date_created} DESC NULLS LAST`, desc(quote.id));

    return { transactions, quotes };
  },

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

  async create(ticket: InsertTicket & { resolvedAt?: Date | null }, scope?: Scope): Promise<Ticket> {
    const values = scope
      ? { ...ticket, orgId: scope.orgId || null, branchId: ticket.branchId ?? scope.branchId ?? null }
      : ticket;
    const [result] = await db.insert(tickets).values(values).returning();
    return result;
  },

  async update(id: string, ticket: TicketWriteValues, scope?: Scope): Promise<Ticket | undefined> {
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
};
