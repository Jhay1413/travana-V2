import { useMutation, useQuery } from "@tanstack/react-query";
import { internalChatApi } from "./internal-chat.api";
import type { ChatMode } from "../types";

export const internalChatKeys = {
  all: ["internal-chat"] as const,
  messages: (sessionId: string) => [...internalChatKeys.all, "messages", sessionId] as const,
};

export function useCreateSession() {
  return useMutation({
    mutationFn: (mode: ChatMode) => internalChatApi.createSession(mode),
  });
}

// The widget renders from LOCAL state (optimistic user message + appended
// reply), so we deliberately do NOT invalidate/refetch the transcript on
// success — refetching mid-conversation was what made the user's own message
// only appear after the reply, and could drop messages on re-fetch.
export function useSendMessage(sessionId: string | null) {
  return useMutation({
    mutationFn: (text: string) => {
      if (!sessionId) throw new Error("No active chat session");
      return internalChatApi.postMessage(sessionId, text);
    },
  });
}

export function useMessages(sessionId: string | null) {
  return useQuery({
    queryKey: internalChatKeys.messages(sessionId ?? ""),
    queryFn: () => internalChatApi.getMessages(sessionId as string),
    enabled: Boolean(sessionId),
  });
}
