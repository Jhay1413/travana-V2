import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attachmentApi } from "./attachment.api";
import { attachmentKeys } from "./use-attachment-queries";

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, file, replyId }: { ticketId: string; file: File; replyId?: string }) =>
      attachmentApi.upload(ticketId, file, replyId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.byTicket(variables.ticketId) });
    },
  });
}

export function useDeleteAttachment(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attachmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.byTicket(ticketId) });
    },
  });
}
