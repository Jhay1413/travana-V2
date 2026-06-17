import { useQuery } from "@tanstack/react-query";
import { facebookApi, type FacebookPagePublic, type FbConversation, type FbMessage } from "./facebook.api";

export const facebookKeys = {
  all: ["facebook"] as const,
  pages: (userId: string) => [...facebookKeys.all, "pages", userId] as const,
  conversations: (pageId: string) => [...facebookKeys.all, "conversations", pageId] as const,
  messages: (conversationId: string) => [...facebookKeys.all, "messages", conversationId] as const,
};

export function useFacebookPages(userId: string) {
  return useQuery<FacebookPagePublic[]>({
    queryKey: facebookKeys.pages(userId),
    queryFn: () => facebookApi.getPages(userId),
    enabled: !!userId,
  });
}

export function useFacebookConversations(pageId: string, userId: string) {
  return useQuery<FbConversation[]>({
    queryKey: facebookKeys.conversations(pageId),
    queryFn: () => facebookApi.getConversations(pageId, userId),
    enabled: !!pageId && !!userId,
    refetchInterval: 15_000,
  });
}

export function useFacebookMessages(conversationId: string, pageId: string, userId: string) {
  return useQuery<FbMessage[]>({
    queryKey: facebookKeys.messages(conversationId),
    queryFn: () => facebookApi.getMessages(conversationId, pageId, userId),
    enabled: !!conversationId && !!pageId && !!userId,
    refetchInterval: 10_000,
  });
}
