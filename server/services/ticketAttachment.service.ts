import { ticketAttachmentRepository } from "../repositories/ticketAttachment.repository";
import { AppError } from "../utils/error-handler";
import type { TicketAttachment, InsertTicketAttachment } from "../types/ticket";

export const ticketAttachmentService = {
  async listByTicketId(ticketId: string): Promise<TicketAttachment[]> {
    return await ticketAttachmentRepository.findByTicketId(ticketId);
  },

  async getAttachmentById(id: string): Promise<TicketAttachment> {
    const attachment = await ticketAttachmentRepository.findById(id);
    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }
    return attachment;
  },

  async createAttachment(data: InsertTicketAttachment): Promise<TicketAttachment> {
    const attachment = await ticketAttachmentRepository.create(data);
    return attachment;
  },

  async deleteAttachment(id: string): Promise<TicketAttachment> {
    const attachment = await ticketAttachmentRepository.findById(id);
    if (!attachment) {
      throw new AppError("Attachment not found", 404);
    }
    await ticketAttachmentRepository.remove(id);
    return attachment;
  },
};
