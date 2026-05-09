import { ticketReplyRepository } from './ticket-reply.repository';
import { ticketRepository } from './ticket.repository';
import { notificationRepository } from '../notification/notification.repository';
import { AppError } from '../../utils/error-handler';
import type { TicketReply, InsertTicketReply } from '@shared/schema';

export const ticketReplyService = {
  async listByTicketId(ticketId: string): Promise<TicketReply[]> {
    return ticketReplyRepository.findByTicketId(ticketId);
  },

  async createReply(data: InsertTicketReply): Promise<TicketReply> {
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

  async updateReply(id: string, content: string): Promise<TicketReply> {
    const reply = await ticketReplyRepository.update(id, content);
    if (!reply) throw new AppError('Reply not found', 404);
    return reply;
  },

  async deleteReply(id: string): Promise<void> {
    await ticketReplyRepository.remove(id);
  },
};
