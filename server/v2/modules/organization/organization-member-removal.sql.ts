import { and, eq, exists, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/database";
import { booking, clientTable, enquiry_table, quote, tasks, tickets, transaction } from "@shared/schema";

/** Ticket statuses that still need someone's attention. */
export const OPEN_TICKET_STATUSES = ["Open", "In Progress"];

/**
 * An open deal owned by `userId`: active, and either an enquiry that is live
 * (not deleted, active, not Lost) or a quote deal with a real (non-copy,
 * non-deleted, not Lost) quote. Booked and Lost deals stay with their owner.
 */
export function openDealCond(orgId: string, userId: string): SQL {
  const liveEnquiry = exists(
    db
      .select({ one: sql`1` })
      .from(enquiry_table)
      .where(and(
        eq(enquiry_table.transaction_id, transaction.id),
        isNull(enquiry_table.deleted_at),
        sql`${enquiry_table.is_active} IS NOT FALSE`,
        sql`${enquiry_table.status} IS DISTINCT FROM 'LOST'`,
      )),
  );
  const liveQuote = exists(
    db
      .select({ one: sql`1` })
      .from(quote)
      .where(and(
        eq(quote.transaction_id, transaction.id),
        sql`${quote.isQuoteCopy} IS NOT TRUE`,
        isNull(quote.deleted_at),
        sql`${quote.quote_status} IS DISTINCT FROM 'lost'`,
      )),
  );
  return and(
    eq(transaction.org_id, orgId),
    eq(transaction.user_id, userId),
    sql`${transaction.is_active} IS NOT FALSE`,
    or(
      and(eq(transaction.status, "on_enquiry"), liveEnquiry),
      and(eq(transaction.status, "on_quote"), liveQuote),
    ),
  ) as SQL;
}

/** Tasks the user still has to do; legacy rows without an org are included. */
export function openTaskCond(orgId: string, userId: string): SQL {
  return and(
    eq(tasks.userId, userId),
    sql`${tasks.completed} IS NOT TRUE`,
    or(eq(tasks.orgId, orgId), isNull(tasks.orgId)),
  ) as SQL;
}

export function openTicketCond(orgId: string, userId: string): SQL {
  return and(
    eq(tickets.assignedTo, userId),
    eq(tickets.orgId, orgId),
    inArray(tickets.status, OPEN_TICKET_STATUSES),
  ) as SQL;
}

export function activeClientCond(orgId: string, userId: string): SQL {
  return and(
    eq(clientTable.createdBy, userId),
    eq(clientTable.orgId, orgId),
    eq(clientTable.status, "active"),
  ) as SQL;
}

/** Tasks attached to any of the given deals (the deal itself or its quotes, enquiries, bookings). */
export function tasksOfDealsCond(dealIds: string[]): SQL {
  return or(
    and(eq(tasks.entityType, "transaction"), inArray(tasks.entityId, dealIds)),
    and(eq(tasks.entityType, "quote"), sql`${tasks.entityId} IN (SELECT ${quote.id}::text FROM ${quote} WHERE ${inArray(quote.transaction_id, dealIds)})`),
    and(eq(tasks.entityType, "enquiry"), sql`${tasks.entityId} IN (SELECT ${enquiry_table.id}::text FROM ${enquiry_table} WHERE ${inArray(enquiry_table.transaction_id, dealIds)})`),
    and(eq(tasks.entityType, "booking"), sql`${tasks.entityId} IN (SELECT ${booking.id}::text FROM ${booking} WHERE ${inArray(booking.transaction_id, dealIds)})`),
  ) as SQL;
}
