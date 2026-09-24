import { ticketRepository } from "./ticket.repository";
import { notificationRepository } from "../notification/notification.repository";

/**
 * `userId`, when provided, scopes the scan to that user's own tickets (see
 * `ticketRepository.findStale`). Omitting it preserves the old global-scan
 * behaviour (e.g. for the removed cron / any future admin-triggered sweep).
 */
export async function checkStaleTickets(userId?: string): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const staleTickets = await ticketRepository.findStale(cutoff, userId);
  if (staleTickets.length === 0) return;

  const links = staleTickets.map((t) => `/tickets/${t.id}`);
  const existing = await notificationRepository.findExistingByTypeAndLinks("ticket_due", links);
  const alreadyNotified = new Set(existing.map((e) => `${e.userId}:${e.link ?? ""}`));

  for (const t of staleTickets) {
    if (!t.userId) continue;
    const link = `/tickets/${t.id}`;
    if (alreadyNotified.has(`${t.userId}:${link}`)) continue;

    try {
      await notificationRepository.create({
        userId: t.userId,
        type: "ticket_due",
        title: "Ticket Needs Attention",
        message: `Ticket "${t.subject}" has been ${t.status} for over 48 hours.`,
        link,
      });
    } catch {
      /* non-fatal */
    }
  }
}
