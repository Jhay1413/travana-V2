import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { conversationsApi, type ListConversationsQuery, type SsBadgeCounts } from "./conversations.api";

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

/**
 * The number to show on the Inbox nav badge (and the inbox's own header
 * badge, which shares this function so the two can never disagree): the count
 * of conversations currently open, i.e. `open_count`.
 *
 * Previously this returned `total_unanswered` (conversations awaiting a
 * reply). That read as "unread", but it under-counts against what an agent
 * actually sees on the Open tab — a conversation already replied to, or one
 * with no reply expected yet, is still sitting in that list, so the badge
 * disagreed with the list it's meant to summarise. `open_count` is the field
 * that matches the Open tab 1:1.
 *
 * Do NOT "improve" this to `unanswered_assigned_to_me + unassigned_count` for
 * multi-agent workspaces. SendSeven's guide describes a badge that way in
 * prose, but it never defines the response fields, and `unassigned_count` is
 * not filtered by reply state — so the sum counts unassigned conversations that
 * have already been answered and reads high. Tried it; it overcounted.
 */
export function unreadBadgeCount(counts: SsBadgeCounts | undefined): number {
  return counts?.open_count ?? 0;
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
