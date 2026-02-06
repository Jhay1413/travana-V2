import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attachmentApi } from "@/api";
import { attachmentKeys } from "@/hooks/queries";

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, file }: { ticketId: string; file: File }) =>
      attachmentApi.upload(ticketId, file),
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
