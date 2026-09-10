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

// A ticket can sit in several caches at once (list, byClient, byUser, detail),
// so the optimistic like patches every cached copy by id rather than one key.
function patchTicketEverywhere(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: (t: Ticket) => Ticket,
) {
  queryClient.setQueriesData<Ticket[] | Ticket | undefined>({ queryKey: ticketKeys.all }, (old) => {
    if (!old) return old;
    if (Array.isArray(old)) return old.map((t) => (t.id === id ? patch(t) : t));
    return old.id === id ? patch(old) : old;
  });
}

export function useToggleTicketLike() {
  const queryClient = useQueryClient();
  const mutationKey = ["tickets", "toggleLike"] as const;
  return useMutation({
    mutationKey,
    mutationFn: (id: string) => ticketApi.toggleLike(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ticketKeys.all });
      const previous = queryClient.getQueriesData<Ticket[] | Ticket>({ queryKey: ticketKeys.all });
      patchTicketEverywhere(queryClient, id, (t) => ({
        ...t,
        likedByMe: !t.likedByMe,
        likeCount: (t.likeCount ?? 0) + (t.likedByMe ? -1 : 1),
      }));
      return { previous };
    },
    // The server answer is authoritative — write it straight into the caches.
    onSuccess: (result, id) => {
      patchTicketEverywhere(queryClient, id, (t) => ({ ...t, likedByMe: result.liked, likeCount: result.likeCount }));
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    // Only refetch once the last in-flight toggle settles.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      }
    },
  });
}
