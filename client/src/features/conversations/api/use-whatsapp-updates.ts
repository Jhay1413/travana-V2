import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsappUpdatesApi } from "./whatsapp-updates.api";
import { conversationsKeys } from "./use-conversations-queries";
import { messagesKeys } from "./use-messages";

const MAX_TIMEOUT_MS = 2_147_483_647;
const EXPIRY_GRACE_MS = 1_000;

/** The conversation's WhatsApp 24-hour window. Only fetched for WhatsApp threads. */
export function useWhatsappWindow(conversationId: string | null, enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: conversationsKeys.whatsappWindow(conversationId ?? ""),
    queryFn: () => whatsappUpdatesApi.getWindow(conversationId as string),
    enabled: !!conversationId && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // When the window runs out, refetch so the composer flips to update mode
  // without waiting for the next message or focus event.
  const data = query.data;
  const windowEndAt = data && data.known && data.inWindow ? data.windowEndAt : null;
  useEffect(() => {
    if (!conversationId || !windowEndAt) return;
    const delay = new Date(windowEndAt).getTime() - Date.now() + EXPIRY_GRACE_MS;
    if (!Number.isFinite(delay) || delay > MAX_TIMEOUT_MS) return;
    const timer = setTimeout(
      () => void qc.invalidateQueries({ queryKey: conversationsKeys.whatsappWindow(conversationId) }),
      Math.max(delay, 0),
    );
    return () => clearTimeout(timer);
  }, [qc, conversationId, windowEndAt]);

  return query;
}

/** Whether the agency has a General update template (no manager-only settings call). */
export function useUpdateTemplate(enabled = true) {
  return useQuery({
    queryKey: conversationsKeys.updateTemplate(),
    queryFn: () => whatsappUpdatesApi.getTemplate(),
    enabled,
    staleTime: 60_000,
  });
}

function useRefreshAfterSend() {
  const qc = useQueryClient();
  return (conversationId: string) => {
    void qc.invalidateQueries({ queryKey: messagesKeys.list(conversationId) });
    void qc.invalidateQueries({ queryKey: conversationsKeys.all });
  };
}

export function useSendWhatsappUpdate() {
  const qc = useQueryClient();
  const refresh = useRefreshAfterSend();
  return useMutation({
    mutationFn: (input: { conversationId: string; text: string }) =>
      whatsappUpdatesApi.sendToConversation(input.conversationId, input.text),
    onSuccess: (_result, input) => {
      refresh(input.conversationId);
      // A viaTemplate:false result means the window is open again; re-check it.
      void qc.invalidateQueries({ queryKey: conversationsKeys.whatsappWindow(input.conversationId) });
    },
  });
}

export function useSendWhatsappToClient() {
  const refresh = useRefreshAfterSend();
  return useMutation({
    mutationFn: (input: { clientId: string; channelId: string; text: string }) =>
      whatsappUpdatesApi.sendToClient(input.clientId, input.channelId, input.text),
    onSuccess: (result) => refresh(result.conversationId),
  });
}
