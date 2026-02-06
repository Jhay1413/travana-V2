import { ticketRepository } from "../repositories/ticket.repository";
import { AppError } from "../utils/error-handler";
import type { Ticket, InsertTicket } from "../types/ticket";

export const ticketService = {
  async listTickets(): Promise<Ticket[]> {
    return await ticketRepository.findAll();
  },

  async listTicketsByClient(clientId: string): Promise<Ticket[]> {
    return await ticketRepository.findByClientId(clientId);
  },

  async listTicketsByUser(userId: string): Promise<Ticket[]> {
    return await ticketRepository.findByUserId(userId);
  },

  async getTicketById(id: string): Promise<Ticket> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    return ticket;
  },

  async createTicket(data: InsertTicket): Promise<Ticket> {
    const ticket = await ticketRepository.create(data);
    return ticket;
  },

  async updateTicket(id: string, data: Partial<InsertTicket>): Promise<Ticket> {
    const ticket = await ticketRepository.update(id, data);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    return ticket;
  },

  async deleteTicket(id: string): Promise<void> {
    await ticketRepository.remove(id);
  },
};
