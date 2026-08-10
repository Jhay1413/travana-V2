import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ticketApi } from "./ticket.api";
import { ticketKeys } from "./use-ticket-queries";
import type { Ticket, CreateTicketData } from "../types";

// These invalidate ticketKeys.all rather than ticketKeys.lists(). Invalidation
// matches by key PREFIX, and the per-user and per-client caches sit alongside
// the list rather than under it:
//
//   lists()          → ["tickets", "list"]
//   byUser(userId)   → ["tickets", "byUser", userId]   ← the sidebar badge
//   byClient(id)     → ["tickets", "byClient", id]
//
// so a lists() invalidation never reached either of them, and the badge stayed
// on its old count after you raised a ticket yourself. The org-wide
// `ticket.changed` SSE event covers other agents' writes; this keeps YOUR tab
// correct immediately, and correct at all when the stream is down.
export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTicketData) => ticketApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Ticket> }) =>
      ticketApi.update(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      queryClient.invalidateQueries({ queryKey: ticketKeys.detail(variables.id) });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ticketApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
}
