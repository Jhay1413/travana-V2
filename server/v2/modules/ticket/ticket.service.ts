import { ticketRepository } from "./ticket.repository";
import { AppError } from "../../utils/error-handler";
import type { Ticket, InsertTicket } from "@shared/schema";
import type { Scope } from "../../utils/scope";

export const ticketService = {
  async listTickets(scope: Scope) {
    return await ticketRepository.findAll(scope);
  },

  async listTicketsByClient(clientId: string, scope: Scope) {
    return await ticketRepository.findByClientId(clientId, scope);
  },

  async listTicketsByUser(userId: string, scope: Scope) {
    return await ticketRepository.findByUserId(userId, scope);
  },

  async getTicketById(id: string, scope?: Scope) {
    const ticket = await ticketRepository.findById(id, scope);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    return ticket;
  },

  async createTicket(data: InsertTicket, scope: Scope): Promise<Ticket> {
    return await ticketRepository.create(data, scope);
  },

  async updateTicket(id: string, data: Partial<InsertTicket>, scope: Scope): Promise<Ticket> {
    const ticket = await ticketRepository.update(id, data, scope);
    if (!ticket) {
      throw new AppError("Ticket not found", 404);
    }
    return ticket;
  },

  async deleteTicket(id: string, scope: Scope): Promise<void> {
    const removed = await ticketRepository.remove(id, scope);
    if (!removed) {
      throw new AppError("Ticket not found", 404);
    }
  },
};
