import { useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationsApi } from "./conversations.api";
import { conversationsKeys } from "./use-conversations-queries";
import type {
  BulkCloseRequest,
  ChannelSwitchRequest,
  CheckExistingConversationRequest,
  CloseConversationRequest,
  ConversationCreate,
  ConversationMergeRequest,
  ConversationUpdate,
  InitiateConversationRequest,
  OpenOrCreateConversationRequest,
  SnoozeConversationRequest,
  TranscriptExportRequest,
} from "./conversations.api";

// Invalidate everything under the conversations root (list + badge counts +
// the affected detail). Cheap and keeps the inbox consistent after a write.
function useInvalidateConversations() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: conversationsKeys.all });
    if (id) qc.invalidateQueries({ queryKey: conversationsKeys.detail(id) });
  };
}

export function useCreateConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (body: ConversationCreate) => conversationsApi.create(body),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useUpdateConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConversationUpdate }) => conversationsApi.update(id, body),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useAssignConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => conversationsApi.assign(id, userId),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useCloseConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: CloseConversationRequest }) => conversationsApi.close(id, body),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useReopenConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.reopen(id),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useSnoozeConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SnoozeConversationRequest }) => conversationsApi.snooze(id, body),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useUnsnoozeConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.unsnooze(id),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useMergeConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ConversationMergeRequest }) => conversationsApi.merge(id, body),
    onSuccess: (conv) => invalidate(conv.id),
  });
}

export function useBulkCloseConversations() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (body: BulkCloseRequest) => conversationsApi.bulkClose(body),
    onSuccess: () => invalidate(),
  });
}

export function useSummarizeConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.summarize(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useTranscriptExport() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TranscriptExportRequest }) => conversationsApi.transcriptExport(id, body),
  });
}

export function useSwitchChannel() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: ChannelSwitchRequest }) => conversationsApi.switchChannel(id, body),
  });
}

export function useInitiateConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (body: InitiateConversationRequest) => conversationsApi.initiate(body),
    onSuccess: (res) => invalidate(res.conversation_id),
  });
}

export function useCheckExistingConversation() {
  return useMutation({
    mutationFn: (body: CheckExistingConversationRequest) => conversationsApi.checkExisting(body),
  });
}

export function useOpenOrCreateConversation() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (body: OpenOrCreateConversationRequest) => conversationsApi.openOrCreate(body),
    onSuccess: (res) => invalidate(res.conversation_id),
  });
}

export function useSearchSimilarConversations() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => conversationsApi.searchSimilar(body),
  });
}

// Best-effort server-side clear of the unread flag when a conversation is
// opened, kept only in case the provider ever gains a write path.
//
// CONFIRMED INEFFECTIVE as of SendSeven's current API: `needs_reply` is derived
// server-side from message direction and is documented only as a GET filter —
// there is no mark-as-read endpoint or read/seen state for conversations. So a
// conversation stays "unanswered" until someone actually replies, and no badge
// count will move on open. The local `seenAt` state in ConversationsInbox is
// what clears the unread dot; failures here stay silent because the call is
// expected not to take effect.
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.update(id, { needs_reply: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conversationsKeys.all });
    },
    onError: () => {
      // Ignore — see comment above.
    },
  });
}

export function useEnableBot() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: ({ id, botId }: { id: string; botId?: string }) => conversationsApi.botEnable(id, botId),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useDisableBot() {
  const invalidate = useInvalidateConversations();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.botDisable(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useEnableConversationAi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.aiStateEnable(id),
    onSuccess: (state, id) => qc.setQueryData(conversationsKeys.aiState(id), state),
  });
}

export function useDisableConversationAi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.aiStateDisable(id),
    onSuccess: (state, id) => qc.setQueryData(conversationsKeys.aiState(id), state),
  });
}
