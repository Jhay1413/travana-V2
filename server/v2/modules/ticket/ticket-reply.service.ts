import { ticketReplyRepository } from './ticket-reply.repository';
import { ticketRepository } from './ticket.repository';
import { notificationRepository } from '../notification/notification.repository';
import { AppError } from '../../utils/error-handler';
import { sanitizeRichText } from '../../utils/sanitize-rich-text';
import type { TicketReply, InsertTicketReply } from '@shared/schema';
import type { Scope } from '../../utils/scope';
import type { TicketReplyWithLikes } from './ticket.types';

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === 'platform_admin') return null;
  return (scope as Scope).orgId || null;
}

function isPlatformAdmin(scope: ScopeOrTrusted): boolean {
  return (scope as Scope).orgRole === 'platform_admin';
}

async function assertTicketInScope(ticketId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await ticketReplyRepository.ticketBelongsToOrg(ticketId, orgId);
  if (!ok) throw new AppError('Ticket not found', 404);
}

async function loadScopedReply(id: string, scope: ScopeOrTrusted): Promise<TicketReply> {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const r = await ticketReplyRepository.findById(id);
    if (!r) throw new AppError('Reply not found', 404);
    return r;
  }
  const row = await ticketReplyRepository.findByIdWithOrg(id);
  if (!row || row.ticketOrgId !== orgId) {
    throw new AppError('Reply not found', 404);
  }
  const { ticketOrgId: _ticketOrgId, ...reply } = row;
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
    await assertTicketInScope(ticketId, scope);
    const viewerUserId = (scope as Scope).userId ?? null;
    return ticketReplyRepository.findByTicketId(ticketId, viewerUserId);
  },

  async createReply(data: InsertTicketReply, scope: ScopeOrTrusted): Promise<TicketReply> {
    await assertTicketInScope(data.ticketId, scope);

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
    const ticket = await ticketRepository.findById(data.ticketId).catch(() => undefined);
    const notifications: Promise<unknown>[] = [];
    if (ticket && ticket.userId !== data.userId) {
      notifications.push(
        notificationRepository.create({
          userId: ticket.userId,
          type: 'ticket_reply',
          title: 'New reply on your ticket',
          message: `Someone replied to "${ticket.subject}"`,
          link: `/tickets/${data.ticketId}`,
          read: false,
        }),
      );
    }
    if (repliedTo && repliedTo.userId !== data.userId && repliedTo.userId !== ticket?.userId) {
      notifications.push(
        notificationRepository.create({
          userId: repliedTo.userId,
          type: 'ticket_reply',
          title: 'New reply to your comment',
          message: `Someone replied to your comment${ticket ? ` on "${ticket.subject}"` : ''}`,
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
