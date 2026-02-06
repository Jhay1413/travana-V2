import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replyApi } from "@/api";
import { replyKeys } from "@/hooks/queries";
import type { CreateReplyData } from "@/types/reply";

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
