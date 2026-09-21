import { useQuery } from "@tanstack/react-query";
import { ticketApi } from "./ticket.api";
import type { Ticket, TicketListScope } from "../types";

export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: (scope: TicketListScope) => [...ticketKeys.lists(), scope] as const,
  details: () => [...ticketKeys.all, "detail"] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
  byClient: (clientId: string) => [...ticketKeys.all, "byClient", clientId] as const,
  byUser: (userId: string) => [...ticketKeys.all, "byUser", userId] as const,
};

export function useTickets(scope: TicketListScope = "mine", options?: { enabled?: boolean }) {
  return useQuery<Ticket[]>({
    queryKey: ticketKeys.list(scope),
    queryFn: () => ticketApi.getAll(scope),
    enabled: options?.enabled ?? true,
    // Always refetch on visit — overrides the global 30s staleTime so the
    // tickets list is never served stale from cache.
    staleTime: 0,
  });
}

export function useTicket(id: string, options?: { enabled?: boolean }) {
  return useQuery<Ticket>({
    queryKey: ticketKeys.detail(id),
    queryFn: () => ticketApi.getById(id),
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useTicketsByClient(clientId: string) {
  return useQuery<Ticket[]>({
    queryKey: ticketKeys.byClient(clientId),
    queryFn: () => ticketApi.getByClient(clientId),
    enabled: !!clientId,
  });
}

export function useTicketsByUser(userId: string, filters?: { statuses?: string[] }) {
  return useQuery<Ticket[]>({
    queryKey: [...ticketKeys.byUser(userId), filters ?? {}] as const,
    queryFn: () => ticketApi.getByUser(userId, filters),
    enabled: !!userId,
  });
}
