import axiosClient from "../client/axios-client";
import type { Ticket, CreateTicketData } from "@/types/ticket";

export const ticketApi = {
  getAll: async (): Promise<Ticket[]> => {
    const { data } = await axiosClient.get<Ticket[]>("/api/tickets");
    return data;
  },

  getById: async (id: string): Promise<Ticket> => {
    const { data } = await axiosClient.get<Ticket>(`/api/tickets/${id}`);
    return data;
  },

  getByClient: async (clientId: string): Promise<Ticket[]> => {
    const { data } = await axiosClient.get<Ticket[]>(`/api/tickets/client/${clientId}`);
    return data;
  },

  getByUser: async (userId: string): Promise<Ticket[]> => {
    const { data } = await axiosClient.get<Ticket[]>(`/api/tickets/user/${userId}`);
    return data;
  },

  create: async (ticketData: CreateTicketData): Promise<Ticket> => {
    const { data } = await axiosClient.post<Ticket>("/api/tickets", ticketData);
    return data;
  },

  update: async (id: string, ticketData: Partial<Ticket>): Promise<Ticket> => {
    const { data } = await axiosClient.patch<Ticket>(`/api/tickets/${id}`, ticketData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/tickets/${id}`);
  },
};
