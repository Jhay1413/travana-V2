import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { conversationsApi, type ListConversationsQuery } from "./conversations.api";

export const conversationsKeys = {
  all: ["conversations"] as const,
  list: (query: ListConversationsQuery) => [...conversationsKeys.all, "list", query] as const,
  detail: (id: string) => [...conversationsKeys.all, "detail", id] as const,
  badgeCounts: (inboxId?: string) => [...conversationsKeys.all, "badge-counts", inboxId ?? null] as const,
  summary: (id: string) => [...conversationsKeys.all, "summary", id] as const,
  previous: (id: string, limit?: number) => [...conversationsKeys.all, "previous", id, limit ?? null] as const,
  switchableChannels: (id: string) => [...conversationsKeys.all, "switchable-channels", id] as const,
  senderOptions: (id: string) => [...conversationsKeys.all, "sender-options", id] as const,
  botSession: (id: string) => [...conversationsKeys.all, "bot-session", id] as const,
  availableBots: (id: string) => [...conversationsKeys.all, "available-bots", id] as const,
  transcript: (id: string, jobId: string) => [...conversationsKeys.all, "transcript", id, jobId] as const,
  trendingTags: (limit?: number) => [...conversationsKeys.all, "trending-tags", limit ?? null] as const,
  aiState: (id: string) => [...conversationsKeys.all, "ai-state", id] as const,
};

export function useConversations(query: ListConversationsQuery = {}) {
  return useQuery({
    queryKey: conversationsKeys.list(query),
    queryFn: () => conversationsApi.list(query),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useConversation(id: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.detail(id ?? ""),
    queryFn: () => conversationsApi.getById(id as string),
    enabled: !!id && enabled,
  });
}

export function useConversationBadgeCounts(inboxId?: string) {
  return useQuery({
    queryKey: conversationsKeys.badgeCounts(inboxId),
    queryFn: () => conversationsApi.badgeCounts(inboxId),
    staleTime: 15_000,
  });
}

export function useConversationSummary(id: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.summary(id ?? ""),
    queryFn: () => conversationsApi.summary(id as string),
    enabled: !!id && enabled,
  });
}

export function usePreviousConversations(id: string | null, limit?: number, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.previous(id ?? "", limit),
    queryFn: () => conversationsApi.previous(id as string, limit),
    enabled: !!id && enabled,
  });
}

export function useSwitchableChannels(id: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.switchableChannels(id ?? ""),
    queryFn: () => conversationsApi.switchableChannels(id as string),
    enabled: !!id && enabled,
  });
}

export function useSenderOptions(id: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.senderOptions(id ?? ""),
    queryFn: () => conversationsApi.senderOptions(id as string),
    enabled: !!id && enabled,
  });
}

export function useBotSession(id: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.botSession(id ?? ""),
    queryFn: () => conversationsApi.botSession(id as string),
    enabled: !!id && enabled,
  });
}

export function useAvailableBots(id: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.availableBots(id ?? ""),
    queryFn: () => conversationsApi.availableBots(id as string),
    enabled: !!id && enabled,
  });
}

export function useTranscriptStatus(id: string | null, jobId: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.transcript(id ?? "", jobId ?? ""),
    queryFn: () => conversationsApi.transcriptStatus(id as string, jobId as string),
    enabled: !!id && !!jobId && enabled,
  });
}

export function useTrendingTags(limit?: number, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.trendingTags(limit),
    queryFn: () => conversationsApi.trendingTags(limit),
    enabled,
  });
}

// Per-conversation AI auto-reply state (active/paused). Short staleTime so the
// badge stays fresh as staff send messages or the AI hands off to a human.
export function useConversationAiState(id: string | null, enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.aiState(id ?? ""),
    queryFn: () => conversationsApi.aiState(id as string),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}
