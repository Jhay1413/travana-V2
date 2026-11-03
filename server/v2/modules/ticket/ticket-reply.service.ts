import { ticketReplyRepository } from './ticket-reply.repository';
import { ticketRepository } from './ticket.repository';
import { notificationRepository } from '../notification/notification.repository';
import { AppError } from '../../utils/error-handler';
import { sanitizeRichText } from '../../utils/sanitize-rich-text';
import type { TicketReply, InsertTicketReply } from '@shared/schema';
import type { Scope } from '../../utils/scope';
import type { ScopeOrTrusted } from '../../utils/scope-conditions';
import type { TicketReplyWithLikes, TicketScopeRef } from './ticket.types';

function isPlatformAdmin(scope: ScopeOrTrusted): boolean {
  return (scope as Scope).orgRole === 'platform_admin';
}

/**
 * The ticket, only if the caller may see it under the ticket's own scope rules
 * (org, branch, creator/assignee, partition). Replies inherit that boundary:
 * out of scope reads as "not found", never "forbidden".
 */
async function requireTicket(ticketId: string, scope: ScopeOrTrusted): Promise<TicketScopeRef> {
  const ticket = await ticketRepository.findByIdScoped(ticketId, scope);
  if (!ticket) throw new AppError('Ticket not found', 404);
  return ticket;
}

async function loadScopedReply(id: string, scope: ScopeOrTrusted): Promise<TicketReply> {
  const reply = await ticketReplyRepository.findById(id);
  if (!reply) throw new AppError('Reply not found', 404);
  const ticket = await ticketRepository.findByIdScoped(reply.ticketId, scope);
  if (!ticket) throw new AppError('Reply not found', 404);
  return reply;
}

/** Sanitised, non-empty reply body — the editor's HTML minus anything scriptable. */
function cleanContent(content: string): string {
  const clean = sanitizeRichText(content);
  if (!clean.replace(/<[^>]*>/g, '').trim()) {
    throw new AppError('Content is required', 400);
  }
  return clean;
}

export const ticketReplyService = {
  async listByTicketId(ticketId: string, scope: ScopeOrTrusted): Promise<TicketReplyWithLikes[]> {
    await requireTicket(ticketId, scope);
    const viewerUserId = (scope as Scope).userId ?? null;
    return ticketReplyRepository.findByTicketId(ticketId, viewerUserId);
  },

  async createReply(data: InsertTicketReply, scope: ScopeOrTrusted): Promise<TicketReply> {
    const ticket = await requireTicket(data.ticketId, scope);

    // Threads are one level deep: a reply to a child is re-pointed at the
    // child's top-level parent, so every UI can render parent + children
    // without losing grandchildren. The person being replied to is still
    // notified below.
    let repliedTo: TicketReply | undefined;
    let parentReplyId: string | null = null;
    if (data.parentReplyId) {
      repliedTo = await ticketReplyRepository.findById(data.parentReplyId);
      if (!repliedTo || repliedTo.ticketId !== data.ticketId) {
        throw new AppError('Parent reply does not belong to this ticket', 400);
      }
      parentReplyId = repliedTo.parentReplyId ?? repliedTo.id;
    }

    const reply = await ticketReplyRepository.create({
      ...data,
      parentReplyId,
      content: cleanContent(data.content),
    });

    // Notifications are a side effect: the reply is saved either way, so a
    // failure here must not turn into a 500 that makes the user post twice.
    // Each person is told at most once, and never the replier: the creator and
    // the assignee ("on your ticket"), then the author of the comment replied to.
    const notified = new Set<string>([data.userId]);
    const notifications: Promise<unknown>[] = [];
    for (const recipient of [ticket.userId, ticket.assignedTo]) {
      if (!recipient || notified.has(recipient)) continue;
      notified.add(recipient);
      notifications.push(
        notificationRepository.create({
          userId: recipient,
          type: 'ticket_reply',
          title: 'New reply on your ticket',
          message: `Someone replied to "${ticket.subject}"`,
          link: `/tickets/${data.ticketId}`,
          read: false,
        }),
      );
    }
    if (repliedTo && !notified.has(repliedTo.userId)) {
      notified.add(repliedTo.userId);
      notifications.push(
        notificationRepository.create({
          userId: repliedTo.userId,
          type: 'ticket_reply',
          title: 'New reply to your comment',
          message: `Someone replied to your comment on "${ticket.subject}"`,
          link: `/tickets/${data.ticketId}`,
          read: false,
        }),
      );
    }
    const results = await Promise.allSettled(notifications);
    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn(`[tickets] reply notification failed for ticket ${data.ticketId}:`, r.reason);
      }
    }

    return reply;
  },

  async updateReply(id: string, content: string, userId: string, scope: ScopeOrTrusted): Promise<TicketReply> {
    const existing = await loadScopedReply(id, scope);
    if (existing.userId !== userId) {
      throw new AppError('You can only update your own reply', 403);
    }
    const reply = await ticketReplyRepository.update(id, cleanContent(content));
    if (!reply) throw new AppError('Reply not found', 404);
    return reply;
  },

  async deleteReply(id: string, userId: string, scope: ScopeOrTrusted): Promise<void> {
    const existing = await loadScopedReply(id, scope);
    if (existing.userId !== userId && !isPlatformAdmin(scope)) {
      throw new AppError('You can only delete your own reply', 403);
    }
    await ticketReplyRepository.remove(id);
  },

  async toggleLike(id: string, userId: string, scope: ScopeOrTrusted): Promise<{ liked: boolean; likeCount: number }> {
    await loadScopedReply(id, scope);
    return ticketReplyRepository.toggleLike(id, userId);
  },
};
