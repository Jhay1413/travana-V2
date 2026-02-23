import { db } from "../config/database";
import { tickets, notifications } from "@shared/schema";
import { eq, and, lt, not, inArray } from "drizzle-orm";

export async function checkStaleTickets(): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const staleTickets = await db
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
        lt(tickets.updatedAt, cutoff)
      )
    );

  if (staleTickets.length === 0) return;

  const ticketIds = staleTickets.map(t => t.id);
  const existing = await db
    .select({ link: notifications.link, userId: notifications.userId })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, "ticket_due"),
        inArray(notifications.link, ticketIds.map(id => `/tickets/${id}`))
      )
    );
  const alreadyNotified = new Set(existing.map(e => `${e.userId}:${e.link}`));

  for (const t of staleTickets) {
    if (!t.userId) continue;
    const link = `/tickets/${t.id}`;
    if (alreadyNotified.has(`${t.userId}:${link}`)) continue;

    try {
      await db.insert(notifications).values({
        userId: t.userId,
        type: "ticket_due",
        title: "Ticket Needs Attention",
        message: `Ticket "${t.subject}" has been ${t.status} for over 48 hours.`,
        link,
      });
    } catch {}
  }
}
