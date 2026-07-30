import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagesApi, type ListMessagesQuery, type MessageCreate, type InternalNoteCreate } from "./messages.api";
import { conversationsKeys } from "./use-conversations-queries";

export const messagesKeys = {
  all: ["messages"] as const,
  list: (conversationId: string) => [...messagesKeys.all, "list", conversationId] as const,
  detail: (id: string) => [...messagesKeys.all, "detail", id] as const,
};

export function useMessages(conversationId: string | null, enabled = true) {
  return useQuery({
    queryKey: messagesKeys.list(conversationId ?? ""),
    queryFn: () => messagesApi.list({ conversationId: conversationId as string }),
    enabled: !!conversationId && enabled,
    staleTime: 10_000,
  });
}

function useAfterWrite(conversationId?: string) {
  const qc = useQueryClient();
  return () => {
    if (conversationId) qc.invalidateQueries({ queryKey: messagesKeys.list(conversationId) });
    // A new message changes the conversation's last_message / preview / ordering.
    qc.invalidateQueries({ queryKey: conversationsKeys.all });
  };
}

export function useSendMessage(conversationId?: string) {
  const afterWrite = useAfterWrite(conversationId);
  return useMutation({
    mutationFn: (body: MessageCreate) => messagesApi.send(body),
    onSuccess: afterWrite,
  });
}

export function useCreateInternalNote(conversationId?: string) {
  const afterWrite = useAfterWrite(conversationId);
  return useMutation({
    mutationFn: (body: InternalNoteCreate) => messagesApi.createInternalNote(body),
    onSuccess: afterWrite,
  });
}

// Upload only — it does not send anything. The caller holds the returned ids and
// passes them as `attachments` on the eventual send, which is what lets a user
// attach several files and still post one message.
export function useUploadAttachment() {
  return useMutation({
    mutationFn: (file: File) => messagesApi.uploadAttachment(file),
  });
}

export function useMessageList(query: ListMessagesQuery, enabled = true) {
  return useQuery({
    queryKey: [...messagesKeys.list(query.conversationId), query.page ?? 1, query.cursor ?? null],
    queryFn: () => messagesApi.list(query),
    enabled: !!query.conversationId && enabled,
  });
}
