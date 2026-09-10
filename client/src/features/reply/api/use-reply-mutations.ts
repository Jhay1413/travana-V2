import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replyApi } from "./reply.api";
import { replyKeys } from "./use-reply-queries";
import type { CreateReplyData, TicketReply } from "../types";

export function useCreateReply(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReplyData) => replyApi.create(ticketId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: replyKeys.byTicket(ticketId) });
    },
  });
}

export function useUpdateReply(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      replyApi.update(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: replyKeys.byTicket(ticketId) });
    },
  });
}

export function useDeleteReply(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => replyApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: replyKeys.byTicket(ticketId) });
    },
  });
}

export function useToggleReplyLike(ticketId: string) {
  const queryClient = useQueryClient();
  const mutationKey = ["replies", "toggleLike", ticketId] as const;
  return useMutation({
    mutationKey,
    mutationFn: (id: string) => replyApi.toggleLike(id),
    onMutate: async (id: string) => {
      const queryKey = replyKeys.byTicket(ticketId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TicketReply[]>(queryKey);
      queryClient.setQueryData<TicketReply[]>(queryKey, (old) =>
        old?.map((reply) =>
          reply.id === id
            ? {
                ...reply,
                likedByMe: !reply.likedByMe,
                likeCount: reply.likeCount + (reply.likedByMe ? -1 : 1),
              }
            : reply,
        ),
      );
      return { previous };
    },
    // The server answer is authoritative — write it straight into the cache
    // rather than trusting the optimistic guess.
    onSuccess: (result, id) => {
      queryClient.setQueryData<TicketReply[]>(replyKeys.byTicket(ticketId), (old) =>
        old?.map((reply) =>
          reply.id === id ? { ...reply, likedByMe: result.liked, likeCount: result.likeCount } : reply,
        ),
      );
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(replyKeys.byTicket(ticketId), context.previous);
      }
    },
    // Only refetch once the last in-flight toggle settles, so a quick burst
    // doesn't refetch mid-way and overwrite a newer optimistic state.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        queryClient.invalidateQueries({ queryKey: replyKeys.byTicket(ticketId) });
      }
    },
  });
}
