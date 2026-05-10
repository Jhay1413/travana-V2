import axiosClient from "../client/axios-client";
import type { Ticket, CreateTicketData } from "@/types/ticket";

export const ticketApi = {
  getAll: async (): Promise<Ticket[]> => {
    const { data } = await axiosClient.get<Ticket[]>("/api/v2/tickets");
    return data;
  },

  getById: async (id: string): Promise<Ticket> => {
    const { data } = await axiosClient.get<Ticket>(`/api/v2/tickets/${id}`);
    return data;
  },

  getByClient: async (clientId: string): Promise<Ticket[]> => {
    const { data } = await axiosClient.get<Ticket[]>(`/api/v2/tickets/client/${clientId}`);
    return data;
  },

  getByUser: async (userId: string, filters?: { statuses?: string[] }): Promise<Ticket[]> => {
    const params = new URLSearchParams();
    if (filters?.statuses && filters.statuses.length > 0) {
      params.set("status", filters.statuses.join(","));
    }
    const qs = params.toString();
    const url = `/api/v2/tickets/user/${userId}${qs ? `?${qs}` : ""}`;
    const { data } = await axiosClient.get<Ticket[]>(url);
    return data;
  },

  create: async (ticketData: CreateTicketData): Promise<Ticket> => {
    const { data } = await axiosClient.post<Ticket>("/api/v2/tickets", ticketData);
    return data;
  },

  update: async (id: string, ticketData: Partial<Ticket>): Promise<Ticket> => {
    const { data } = await axiosClient.patch<Ticket>(`/api/v2/tickets/${id}`, ticketData);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/tickets/${id}`);
  },
};
