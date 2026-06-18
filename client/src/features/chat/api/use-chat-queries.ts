import { useQuery } from "@tanstack/react-query";
import { chatApi } from "./chat.api";
import type { ChatConversation, ChatMessage } from "@/features/chat/types";

export const chatKeys = {
  all: ["chat"] as const,
  conversations: () => [...chatKeys.all, "conversations"] as const,
  messages: (conversationId: string) => [...chatKeys.all, "messages", conversationId] as const,
};

export function useChatConversations() {
  return useQuery<ChatConversation[]>({
    queryKey: chatKeys.conversations(),
    queryFn: chatApi.getConversations,
    refetchInterval: 2000,
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
