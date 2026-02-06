import { useQuery } from "@tanstack/react-query";
import { ticketApi } from "@/api";
import type { Ticket } from "@/types/ticket";

export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: () => [...ticketKeys.lists()] as const,
  details: () => [...ticketKeys.all, "detail"] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  byClient: (clientId: string) => [...ticketKeys.all, "byClient", clientId] as const,
  byUser: (userId: string) => [...ticketKeys.all, "byUser", userId] as const,
};

export function useTickets() {
  return useQuery<Ticket[]>({
    queryKey: ticketKeys.list(),
    queryFn: ticketApi.getAll,
  });
}

export function useTicket(id: string) {
  return useQuery<Ticket>({
    queryKey: ticketKeys.detail(id),
    queryFn: () => ticketApi.getById(id),
    enabled: !!id,
  });
}

export function useTicketsByClient(clientId: string) {
  return useQuery<Ticket[]>({
    queryKey: ticketKeys.byClient(clientId),
    queryFn: () => ticketApi.getByClient(clientId),
    enabled: !!clientId,
  });
}

export function useTicketsByUser(userId: string) {
  return useQuery<Ticket[]>({
    queryKey: ticketKeys.byUser(userId),
    queryFn: () => ticketApi.getByUser(userId),
    enabled: !!userId,
  });
}
