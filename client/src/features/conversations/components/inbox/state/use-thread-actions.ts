import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { toUiMessage } from "../../../map";
import { messageTypeForContentType } from "../../../api/messages.api";
import {
  useAssignConversation,
  useMarkConversationRead,
  useReopenConversation,
  useSnoozeConversation,
  useUnsnoozeConversation,
  useUpdateConversation,
} from "../../../api/use-conversations-mutations";
import { conversationsKeys } from "../../../api/use-conversations-queries";
import { useCreateInternalNote, useMessages, useSendMessage } from "../../../api/use-messages";
import { useSendWhatsappUpdate } from "../../../api/use-whatsapp-updates";
import type { ConversationMessage } from "../../../types";
import type { PendingAttachment } from "../composer";
import { firstNameFor } from "../enquiry";
import { describeUpdateError, isUpdateTemplateMissing, snoozeUntil, type SnoozePresetId } from "../lib";
import type { InboxState } from "./use-inbox-state";

export interface ComposerAttachments {
  ids: string[];
  filenames: string[];
  contentTypes: string[];
}

function errorText(err: unknown): string {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? "Unknown error";
}

const YEAR_HOURS = 24 * 365;

export function useThreadActions(state: InboxState) {
  const { selected, selectedId, overlay, setOverlay, clearOptimistic, settleSnoozeOverride, markSeen, conversations } = state;
  const { toast } = useToast();
  const qc = useQueryClient();
  const snoozeMutation = useSnoozeConversation();
  const unsnoozeMutation = useUnsnoozeConversation();
  const reopenMutation = useReopenConversation();
  const markReadMutation = useMarkConversationRead();
  const assignMutation = useAssignConversation();
  const updateMutation = useUpdateConversation();

  // Stamp "seen" the moment a conversation is opened (covers both the row
  // onClick and any auto-selection path) so the unread dot clears instantly.
  // Also best-effort tells SendSeven the conversation was read: `selected.unread`
  // here still reflects the pre-stamp state since `seenAt` hasn't been updated
  // yet this render. Re-runs when the open conversation's lastActivityAt moves
  // too, so a message arriving while the thread is on screen doesn't re-light
  // its unread dot.
  useEffect(() => {
    if (!selectedId) return;
    const wasUnread = selected?.unread ?? false;
    markSeen(selectedId);
    if (wasUnread) {
      markReadMutation.mutate(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.lastActivityAt]);

  // Real thread for the selected conversation (the list only carries the
  // last_message). Falls back to that seed while the messages query loads.
  const { data: messagesData, isLoading: messagesLoading } = useMessages(selectedId);
  const sendMessage = useSendMessage(selectedId ?? undefined);
  const createNote = useCreateInternalNote(selectedId ?? undefined);
  const sendWhatsappUpdate = useSendWhatsappUpdate();

  const optimistic = useMemo(
    () => (selectedId ? (overlay[selectedId]?.extraMessages ?? []) : []),
    [overlay, selectedId],
  );

  const threadMessages = useMemo(() => {
    const base = messagesData ? messagesData.items.map(toUiMessage) : (selected?.messages ?? []);
    const baseIds = new Set(base.map((m) => m.id));
    const merged = [...base, ...optimistic.filter((m) => !baseIds.has(m.id))];
    return merged.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }, [messagesData, selected, optimistic]);

  const addOptimistic = (convId: string, msg: ConversationMessage) =>
    setOverlay((prev) => {
      const cur = prev[convId] ?? { extraMessages: [] };
      return { ...prev, [convId]: { ...cur, extraMessages: [...cur.extraMessages, msg] } };
    });

  const dropOptimistic = (convId: string, msgId: string) =>
    setOverlay((prev) => {
      const cur = prev[convId];
      if (!cur) return prev;
      return { ...prev, [convId]: { ...cur, extraMessages: cur.extraMessages.filter((m) => m.id !== msgId) } };
    });

  const sendFailed = (err: unknown) =>
    toast({ title: "Couldn't send", description: errorText(err), variant: "destructive" });

  const handleSend = async (
    convId: string,
    body: string,
    mode: "reply" | "note" | "update",
    attachments?: ComposerAttachments,
  ): Promise<void> => {
    const hasFiles = (attachments?.ids.length ?? 0) > 0;
    // Optimistic bubble for instant feedback; the attachments themselves only
    // appear once the refetch lands (we hold ids, not the rendered media), so
    // name them in the placeholder rather than showing an empty bubble.
    const optimisticMsg: ConversationMessage = {
      id: `opt-${convId}-${new Date().getTime()}`,
      direction: "outbound",
      body: body || (hasFiles ? attachments!.filenames.join(", ") : ""),
      sentAt: new Date().toISOString(),
      authorName: "You",
      read: false,
      isNote: mode === "note",
    };
    addOptimistic(convId, optimisticMsg);
    // Then persist via the real SendSeven message endpoint; on success the
    // messages query refetches and we drop the optimistic copy to avoid dupes.
    try {
      if (mode === "update") {
        const result = await sendWhatsappUpdate.mutateAsync({ conversationId: convId, text: body });
        if (!result.viaTemplate) {
          toast({ title: "The window had reopened, so it went as a normal message" });
        }
      } else if (mode === "note") {
        await createNote.mutateAsync({ conversation_id: convId, text: body });
      } else {
        await sendMessage.mutateAsync({
          conversation_id: convId,
          // SendSeven media sends must declare the media kind (image/video/
          // audio/document) as the message_type; "text" carries plain text
          // only. Derived from the first attachment: SendSeven delivers one
          // attachment per message downstream, so the first decides. `text`
          // still rides along as the caption.
          message_type: hasFiles ? messageTypeForContentType(attachments!.contentTypes[0] ?? "") : "text",
          text: body,
          ...(hasFiles ? { attachments: attachments!.ids, attachment_filenames: attachments!.filenames } : {}),
        });
      }
      clearOptimistic(convId);
    } catch (err) {
      dropOptimistic(convId, optimisticMsg.id);
      if (mode === "update") {
        const conv = conversations.find((c) => c.id === convId);
        const info = describeUpdateError(err, conv ? firstNameFor(null, conv.contact) : "them");
        toast({ title: info.title, description: info.description, variant: "destructive" });
      } else {
        sendFailed(err);
      }
      // A rejected WhatsApp send usually means our idea of the 24-hour window
      // was stale, so refetch it and let the composer switch modes.
      const failedConv = conversations.find((c) => c.id === convId);
      if (mode !== "note" && (failedConv?.channel === "whatsapp" || isUpdateTemplateMissing(err))) {
        void qc.invalidateQueries({ queryKey: conversationsKeys.whatsappWindow(convId) });
        if (isUpdateTemplateMissing(err)) void qc.invalidateQueries({ queryKey: conversationsKeys.updateTemplate() });
      }
      // The composer keeps the text when onSend throws.
      throw err;
    }
  };

  // Composer.onSend(text, attachments).
  const sendReply = (text: string, attachments: PendingAttachment[]) => {
    if (!selected) return Promise.resolve();
    return handleSend(selected.id, text, "reply", {
      ids: attachments.map((a) => a.id ?? ""),
      filenames: attachments.map((a) => a.file.name),
      contentTypes: attachments.map((a) => a.contentType ?? a.file.type),
    });
  };

  // Composer.onSendUpdate(text): WhatsApp, window closed, via the General update template.
  const sendUpdate = (text: string) => (selected ? handleSend(selected.id, text, "update") : Promise.resolve());

  const sendNote = (text: string) => (selected ? handleSend(selected.id, text, "note") : Promise.resolve());

  // Snoozes use `reopen_on_message: true` so a customer reply pulls the thread
  // straight back into Open: the provider clears the snooze on the first
  // genuine inbound message when this flag is set.
  const snoozeUntilDate = (convId: string, until: Date) => {
    // Optimistically mark it snoozed so it leaves the Open list immediately.
    setOverlay((prev) => {
      const cur = prev[convId] ?? { extraMessages: [] };
      return { ...prev, [convId]: { ...cur, snoozed: true } };
    });
    // mutateAsync, not mutate(vars, callbacks): TanStack only fires per-call
    // callbacks for the latest call, which would skip settling earlier rows.
    const settle = settleSnoozeOverride(convId);
    void snoozeMutation
      .mutateAsync({ id: convId, body: { snoozed_until: until.toISOString(), reopen_on_message: true } })
      .then(settle.onSuccess, settle.onError);
  };

  const snoozeFor = (convId: string, presetId: SnoozePresetId) => snoozeUntilDate(convId, snoozeUntil(presetId, new Date()));

  const unsnooze = (convId: string) => {
    setOverlay((prev) => {
      const cur = prev[convId] ?? { extraMessages: [] };
      return { ...prev, [convId]: { ...cur, snoozed: false } };
    });
    const settle = settleSnoozeOverride(convId);
    void unsnoozeMutation.mutateAsync(convId).then(settle.onSuccess, settle.onError);
  };

  // "Mark done" (the old "Close conversation"): SendSeven's close endpoint isn't
  // in our list scope, so closing is modelled as a year-long snooze (the API
  // only requires "must be in the future", and reopen_on_message still pulls
  // the thread back to Open if the client ever writes again). An internal note
  // stamps when it was closed so the thread carries an audit trail.
  const closeConversation = (convId: string) => {
    const closedAt = new Date().toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    // Note first, while the conversation is still the selection: the snooze
    // optimistically drops it out of the Open list, which moves the selection.
    void handleSend(convId, `Close conversation from: ${closedAt}`, "note").catch(() => undefined);
    snoozeUntilDate(convId, new Date(Date.now() + YEAR_HOURS * 60 * 60 * 1000));
  };

  // A truly closed conversation is reopened server-side; a done/snoozed one is
  // simply unsnoozed.
  const reopen = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv?.status === "closed") {
      void reopenMutation
        .mutateAsync(convId)
        .then(undefined, (err: unknown) =>
          toast({ title: "Could not reopen", description: errorText(err), variant: "destructive" }),
        );
      return;
    }
    unsnooze(convId);
  };

  const assign = (convId: string, userId: string | null) => {
    const onError = (err: unknown) =>
      toast({ title: "Could not update assignment", description: errorText(err), variant: "destructive" });
    if (userId) {
      void assignMutation.mutateAsync({ id: convId, userId }).then(
        (conv) =>
          toast({
            title: "Conversation assigned",
            description: (conv.assigned_user as { name?: string } | null)?.name ?? undefined,
          }),
        onError,
      );
    } else {
      void updateMutation
        .mutateAsync({ id: convId, body: { assigned_user_id: null } })
        .then(() => toast({ title: "Conversation unassigned" }), onError);
    }
  };

  return {
    threadMessages,
    messagesLoading,
    isSending: sendMessage.isPending || createNote.isPending || sendWhatsappUpdate.isPending,
    sendReply,
    sendUpdate,
    sendNote,
    snoozeFor,
    unsnooze,
    closeConversation,
    reopen,
    assign,
  };
}
