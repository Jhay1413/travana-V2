// The single definition of "my active tickets", shared by the tickets page's
// default view and the sidebar's badge count.
//
// These were written twice and drifted: the badge counted `assignedTo === me`
// only, while the page's "Me" filter also kept unassigned tickets you raised and
// ones you raised that were handed on. The badge therefore read LOWER than the
// number of rows the page showed under the same filter, with no way to tell
// which was right. One predicate, used by both, is the fix.
//
// NOTE — this aligns the two numbers, it does not make either correct for the
// `agent`/`homeworker` roles. Their queries are still scoped on tickets.userId
// (the CREATOR) in ticket.repository.ts, so a ticket someone else assigned to
// them reaches neither the list nor this count. That is a separate server-side
// fix; both sides being consistently wrong is the point of doing this first.

import type { Ticket } from "../types";

type TicketLike = Pick<Ticket, "userId" | "assignedTo" | "status"> & { replyCount?: number };

/** Not yet done: anything a person still has to act on. */
export function isActiveTicket(ticket: Pick<Ticket, "status">): boolean {
  const status = (ticket.status || "").toLowerCase();
  return status !== "resolved" && status !== "closed";
}

/**
 * Whether `userId` should see this ticket under a "Me" filter. Three ways in:
 *
 * 1. it is assigned to them;
 * 2. nobody is assigned and they raised it — an unassigned ticket is still the
 *    raiser's to chase, so it must not fall through the gap;
 * 3. they raised it, it was handed to someone else, and it has replies — the
 *    thread is live and they are party to it.
 */
export function isMyTicket(ticket: TicketLike, userId: string | undefined): boolean {
  if (!userId) return false;
  const assignedToMe = ticket.assignedTo === userId;
  const mineUnassigned = !ticket.assignedTo && ticket.userId === userId;
  const handedOnWithReplies =
    ticket.userId === userId &&
    !!ticket.assignedTo &&
    ticket.assignedTo !== userId &&
    (ticket.replyCount || 0) > 0;
  return assignedToMe || mineUnassigned || handedOnWithReplies;
}

/**
 * The sidebar badge number. Tolerates a missing/!Array payload so the badge can
 * be driven straight off a query that hasn't resolved yet.
 */
export function countMyActiveTickets(tickets: unknown, userId: string | undefined): number {
  if (!Array.isArray(tickets) || !userId) return 0;
  return (tickets as TicketLike[]).filter((t) => isMyTicket(t, userId) && isActiveTicket(t)).length;
}
