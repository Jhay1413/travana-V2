import { ticketAttachmentRepository } from './ticket-attachment.repository';
import { AppError } from '../../utils/error-handler';
import type { TicketAttachment, InsertTicketAttachment } from '@shared/schema';

export const ticketAttachmentService = {
  async listByTicketId(ticketId: string): Promise<TicketAttachment[]> {
    return ticketAttachmentRepository.findByTicketId(ticketId);
  },

  async getAttachmentById(id: string): Promise<TicketAttachment> {
    const attachment = await ticketAttachmentRepository.findById(id);
    if (!attachment) throw new AppError('Attachment not found', 404);
    return attachment;
  },

  async createAttachment(data: InsertTicketAttachment): Promise<TicketAttachment> {
    return ticketAttachmentRepository.create(data);
  },

  async deleteAttachment(id: string): Promise<TicketAttachment> {
    const attachment = await ticketAttachmentRepository.findById(id);
    if (!attachment) throw new AppError('Attachment not found', 404);
    await ticketAttachmentRepository.remove(id);
    return attachment;
  },
};
