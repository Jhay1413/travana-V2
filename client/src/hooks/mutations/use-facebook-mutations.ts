import { useMutation, useQueryClient } from "@tanstack/react-query";
import { facebookApi } from "@/api/endpoints/facebook.api";
import { facebookKeys } from "@/hooks/queries/use-facebook-queries";
import { useToast } from "@/hooks/use-toast";

export function useDisconnectFacebookPage(userId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (pageId: string) => facebookApi.disconnectPage(pageId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facebookKeys.pages(userId) });
      toast({ title: "Page disconnected" });
    },
  });
}

export function useSendFacebookMessage(pageId: string, conversationId: string, userId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ recipientId, text }: { recipientId: string; text: string }) =>
      facebookApi.sendMessage(pageId, recipientId, text, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facebookKeys.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: facebookKeys.conversations(pageId) });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send message", description: err.message, variant: "destructive" });
    },
  });
}
