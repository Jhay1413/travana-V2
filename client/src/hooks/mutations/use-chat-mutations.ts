import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "@/api";
import { chatKeys } from "@/hooks/queries/use-chat-queries";

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      chatApi.sendMessage(conversationId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useSendMessageWithFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content, file }: { conversationId: string; content: string; file: File }) =>
      chatApi.sendMessageWithFile(conversationId, content, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useStartDirectChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetUserId: string) => chatApi.startDirectChat(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useCreateGroupChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, participantIds }: { name: string; participantIds: string[] }) =>
      chatApi.createGroupChat(name, participantIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}

export function useMarkChatRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.markRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    },
  });
}
