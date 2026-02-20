import { useQuery } from "@tanstack/react-query";
import { chatApi } from "@/api";
import type { ChatConversation, ChatMessage } from "@/types/chat";

export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  messages: (conversationId: string) => [...chatKeys.all, "messages", conversationId] as const,
};

export function useChatConversations() {
  return useQuery<ChatConversation[]>({
    queryKey: chatKeys.conversations(),
    queryFn: chatApi.getConversations,
    refetchInterval: 5000,
  });
}

export function useChatMessages(conversationId: string) {
  return useQuery<ChatMessage[]>({
    queryKey: chatKeys.messages(conversationId),
    queryFn: () => chatApi.getMessages(conversationId),
    enabled: !!conversationId,
    refetchInterval: 3000,
  });
}
