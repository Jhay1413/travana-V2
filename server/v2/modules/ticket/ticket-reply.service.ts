import { ticketReplyRepository } from './ticket-reply.repository';
import { ticketRepository } from './ticket.repository';
import { notificationRepository } from '../notification/notification.repository';
import { AppError } from '../../utils/error-handler';
import type { TicketReply, InsertTicketReply } from '@shared/schema';
import type { Scope } from '../../utils/scope';

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === 'platform_admin') return null;
  return (scope as Scope).orgId || null;
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
  const r = await ticketReplyRepository.findById(id);
  if (!r) throw new AppError('Reply not found', 404);
  return r;
}

export const ticketReplyService = {
  async listByTicketId(ticketId: string, scope: ScopeOrTrusted): Promise<TicketReply[]> {
    await assertTicketInScope(ticketId, scope);
    return ticketReplyRepository.findByTicketId(ticketId);
  },

  async createReply(data: InsertTicketReply, scope: ScopeOrTrusted): Promise<TicketReply> {
    await assertTicketInScope(data.ticketId, scope);
    const reply = await ticketReplyRepository.create(data);

    const ticket = await ticketRepository.findById(data.ticketId);
    if (ticket && ticket.userId !== data.userId) {
      await notificationRepository.create({
        userId: ticket.userId,
        type: 'ticket_reply',
        title: 'New reply on your ticket',
        message: `Someone replied to "${ticket.subject}"`,
        link: `/tickets/${data.ticketId}`,
        read: false,
      });
    }

    return reply;
  },

  async updateReply(id: string, content: string, scope: ScopeOrTrusted): Promise<TicketReply> {
    await loadScopedReply(id, scope);
    const reply = await ticketReplyRepository.update(id, content);
    if (!reply) throw new AppError('Reply not found', 404);
    return reply;
  },

  async deleteReply(id: string, scope: ScopeOrTrusted): Promise<void> {
    await loadScopedReply(id, scope);
    await ticketReplyRepository.remove(id);
  },
};
