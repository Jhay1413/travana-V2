import { ticketRepository } from "./ticket.repository";
import { AppError } from "../../utils/error-handler";
import type { Ticket, InsertTicket } from "@shared/schema";

export const ticketService = {
  async listTickets() {
    return await ticketRepository.findAll();
  },

  async listTicketsByClient(clientId: string) {
    return await ticketRepository.findByClientId(clientId);
  },

  async listTicketsByUser(userId: string) {
    return await ticketRepository.findByUserId(userId);
  },

  async getTicketById(id: string) {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    return ticket;
  },

  async createTicket(data: InsertTicket): Promise<Ticket> {
    return await ticketRepository.create(data);
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
