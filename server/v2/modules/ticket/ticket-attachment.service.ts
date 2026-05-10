import { ticketAttachmentRepository } from './ticket-attachment.repository';
import { AppError } from '../../utils/error-handler';
import type { TicketAttachment, InsertTicketAttachment } from '@shared/schema';
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
  const ok = await ticketAttachmentRepository.ticketBelongsToOrg(ticketId, orgId);
  if (!ok) throw new AppError('Attachment not found', 404);
}

async function loadScopedAttachment(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const a = await ticketAttachmentRepository.findById(id);
    if (!a) throw new AppError('Attachment not found', 404);
    return a;
  }
  const row = await ticketAttachmentRepository.findByIdWithOrg(id);
  if (!row || row.ticketOrgId !== orgId) {
    throw new AppError('Attachment not found', 404);
  }
  const a = await ticketAttachmentRepository.findById(id);
  if (!a) throw new AppError('Attachment not found', 404);
  return a;
}

export const ticketAttachmentService = {
  async listByTicketId(ticketId: string, scope: ScopeOrTrusted): Promise<TicketAttachment[]> {
    await assertTicketInScope(ticketId, scope);
    return ticketAttachmentRepository.findByTicketId(ticketId);
  },

  async getAttachmentById(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    return loadScopedAttachment(id, scope);
  },

  async createAttachment(data: InsertTicketAttachment, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    await assertTicketInScope(data.ticketId, scope);
    return ticketAttachmentRepository.create(data);
  },

  async deleteAttachment(id: string, scope: ScopeOrTrusted): Promise<TicketAttachment> {
    const attachment = await loadScopedAttachment(id, scope);
    await ticketAttachmentRepository.remove(id);
    return attachment;
  },
};
