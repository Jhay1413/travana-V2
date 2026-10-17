import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Loader2, Paperclip, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAiSuggestReply } from "../../../api/use-conversations-mutations";
import type { AiReplyTone } from "../../../api/conversations.api";
import type { Conversation } from "../../../types";
import { CHANNEL_META, Segmented } from "../shared";
import { AttachmentChips } from "./attachment-chips";
import { EmojiPopover } from "./emoji-popover";
import { LunaPopover } from "./luna-popover";
import { useAttachments, type PendingAttachment } from "./use-attachments";
import { useTypingPing } from "./use-typing-ping";

const TEXTAREA_EMPTY_HEIGHT_PX = 62;
const TEXTAREA_FILLED_HEIGHT_PX = 104;
const TEXTAREA_MAX_HEIGHT_PX = 200;
const DRAFT_DEBOUNCE_MS = 300;

export interface ComposerDraft {
  tab: "reply" | "note";
  reply: string;
  note: string;
}

/** What the owner can call on a mounted composer. */
export interface ComposerHandle {
  /** Replaces the reply text, switches to Reply and saves the draft right away. */
  setReplyText(text: string): void;
}

export interface ComposerProps {
  conversation: Conversation;
  draft: ComposerDraft;
  onDraftChange(d: ComposerDraft): void;
  onSend(text: string, attachments: PendingAttachment[]): Promise<void> | void;
  onAddNote(text: string): Promise<void> | void;
  isSending: boolean;
  firstName: string;
  generateEnquiry: ReactNode;
  /** Filled with the composer's handle while it is mounted. */
  composerRef?: MutableRefObject<ComposerHandle | null>;
}

export function Composer({
  conversation,
  draft,
  onDraftChange,
  onSend,
  onAddNote,
  isSending,
  firstName,
  generateEnquiry,
  composerRef,
}: ComposerProps) {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pingTyping, sendTypingStop } = useTypingPing(conversation.id);
  const { attachments, uploading, ready, pickFiles, removeAttachment, clearAttachments } = useAttachments();
  const redraft = useAiSuggestReply();
  // True while the reply text is a Luna insert the agent hasn't touched yet.
  const [lunaDrafted, setLunaDrafted] = useState(false);

  const [mode, setMode] = useState<"reply" | "note">(draft.tab);
  // The box is driven by local state so a keystroke re-renders only the composer;
  // the owner's draft store is told after a pause (and on mode switch / send /
  // unmount). Seeded once - the composer is keyed per conversation.
  const [local, setLocalState] = useState({ reply: draft.reply, note: draft.note });
  const localRef = useRef(local);
  const tabRef = useRef<"reply" | "note">(draft.tab);
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const setLocal = useCallback((next: { reply: string; note: string }) => {
    localRef.current = next;
    setLocalState(next);
  }, []);

  const flush = useCallback((tab?: "reply" | "note") => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = false;
    onDraftChangeRef.current({ tab: tab ?? tabRef.current, ...localRef.current });
  }, []);

  const scheduleFlush = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(), DRAFT_DEBOUNCE_MS);
  }, [flush]);

  // Flush any pending text when the composer goes away (conversation switch).
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (dirtyRef.current) onDraftChangeRef.current({ tab: tabRef.current, ...localRef.current });
    },
    [],
  );

  const text = mode === "note" ? local.note : local.reply;
  // Internal notes are text-only in SendSeven's API - there's no attachments
  // field on the internal-notes endpoint - so the picker is disabled in note mode.
  const canAttach = mode === "reply";
  const channelLabel = CHANNEL_META[conversation.channel].label;

  const setText = (value: string) => {
    setLocal(mode === "note" ? { ...localRef.current, note: value } : { ...localRef.current, reply: value });
    scheduleFlush();
  };

  const setReplyText = (value: string) => {
    setLocal({ ...localRef.current, reply: value });
    tabRef.current = "reply";
    setMode("reply");
    flush("reply");
  };

  const setReplyTextRef = useRef(setReplyText);
  setReplyTextRef.current = setReplyText;
  useEffect(() => {
    if (!composerRef) return;
    composerRef.current = { setReplyText: (value) => setReplyTextRef.current(value) };
    return () => {
      composerRef.current = null;
    };
  }, [composerRef]);

  // Auto-size: 62px empty, 104px once there is text, growing with the content.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const base = text ? TEXTAREA_FILLED_HEIGHT_PX : TEXTAREA_EMPTY_HEIGHT_PX;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, base), TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [text, mode]);

  // Insert at the caret rather than appending, and hand focus back so typing
  // continues where the emoji landed.
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + emoji.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  const insertFromLuna = (value: string) => {
    setReplyText(value);
    setLunaDrafted(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const redo = (tone?: AiReplyTone) => {
    if (redraft.isPending) return;
    redraft.mutate(
      { id: conversation.id, tone, count: 1 },
      {
        onSuccess: ({ suggestion }) => insertFromLuna(suggestion),
        onError: (err) =>
          toast({ title: "Couldn't generate a reply", description: (err as Error).message, variant: "destructive" }),
      },
    );
  };

  const submit = async () => {
    const trimmed = text.trim();
    // Never send mid-upload — the ids aren't in yet.
    if ((mode === "reply" && uploading) || isSending) return;
    // An attachment on its own is a valid reply; text is otherwise required.
    if (!trimmed && !(mode === "reply" && ready.length > 0)) {
      toast({ title: "Write something first." });
      return;
    }
    sendTypingStop();
    try {
      if (mode === "note") await onAddNote(trimmed);
      else await onSend(trimmed, ready);
    } catch {
      // The owner reports the failure; keep the text so nothing is lost.
      return;
    }
    // Clear only what was submitted; anything typed while the send was in
    // flight stays in the box.
    const current = localRef.current;
    const field = mode === "note" ? "note" : "reply";
    const live = current[field];
    const remaining = live === text ? "" : live.startsWith(text) ? live.slice(text.length) : live;
    setLocal({ ...current, [field]: remaining });
    flush();
    if (mode === "reply") {
      clearAttachments();
      if (!remaining) setLunaDrafted(false);
    }
  };

  return (
    <div className="border-t border-social-border px-4 pb-4 pt-3" data-testid="conversation-composer">
      <Segmented
        value={mode}
        onChange={(tab) => {
          tabRef.current = tab;
          setMode(tab);
          flush(tab);
        }}
        items={[
          { value: "reply", label: "Reply" },
          { value: "note", label: "Internal note" },
        ]}
        height={38}
        className="w-[236px]"
      />

      {mode === "reply" && lunaDrafted && text && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#F5F3FF] px-3 py-1.5 text-[12px] text-[#6D28D9] dark:bg-violet-500/10 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Drafted by Luna. Check it before you send.</span>
          <span className="ml-auto flex items-center gap-1">
            {redraft.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            <button type="button" onClick={() => redo()} disabled={redraft.isPending} className="rounded px-1.5 py-0.5 font-semibold hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-50">
              Redo
            </button>
            <button type="button" onClick={() => redo("short")} disabled={redraft.isPending} className="rounded px-1.5 py-0.5 font-semibold hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-50">
              Shorter
            </button>
            <button type="button" onClick={() => redo("friendly")} disabled={redraft.isPending} className="rounded px-1.5 py-0.5 font-semibold hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-50">
              Friendlier
            </button>
          </span>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (mode === "reply" && lunaDrafted && !e.target.value) setLunaDrafted(false);
          // Clearing the box is as much a "stopped" as pausing is.
          if (e.target.value.trim()) pingTyping();
          else sendTypingStop();
        }}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter sends; Enter and Shift+Enter both insert a newline.
          if (e.key !== "Enter") return;
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            void submit();
          } else if (e.shiftKey) {
            e.preventDefault();
            const el = e.currentTarget;
            const start = el.selectionStart;
            setText(el.value.slice(0, start) + "\n" + el.value.slice(el.selectionEnd));
            requestAnimationFrame(() => el.setSelectionRange(start + 1, start + 1));
          }
        }}
        placeholder={
          mode === "note"
            ? "Write an internal note. Only your team can see it."
            : `Reply to ${firstName} on ${channelLabel}…`
        }
        // Native browser spellcheck, stated explicitly so it can't be lost, with
        // the dictionary pinned to en-GB — on a US-locale machine the browser
        // otherwise flags "organise"/"colour" in every outbound message.
        spellCheck
        lang="en-GB"
        className={cn(
          "mt-3 block w-full resize-none rounded-xl border px-3.5 py-2.5 text-[14px] leading-[1.55] outline-none transition focus-visible:ring-2 focus-visible:ring-social-orange/40",
          mode === "note"
            ? "border-dashed border-[#FCD34D] bg-[#FFFBEB] dark:bg-amber-950/30"
            : "border-social-border bg-card",
        )}
        data-testid="conversation-composer-input"
      />
      <div className="mt-1 text-right text-[11px] text-muted-foreground">Ctrl+Enter to send</div>

      {attachments.length > 0 && (
        <div className="mt-2">
          <AttachmentChips attachments={attachments} onRemove={removeAttachment} />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          pickFiles(e.target.files);
          // Reset so picking the same file twice in a row still fires onChange.
          e.target.value = "";
        }}
        data-testid="conversation-composer-file-input"
      />

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <EmojiPopover onPick={insertEmoji} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canAttach}
            title={canAttach ? "Attach a file" : "Attachments aren't supported on internal notes"}
            aria-label="Attach a file"
            className="grid h-9 w-9 place-items-center rounded-lg text-black/55 transition hover:bg-black/5 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
            data-testid="conversation-composer-attach"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {generateEnquiry}
          <LunaPopover
            conversationId={conversation.id}
            firstName={firstName}
            disabled={isSending}
            onInsert={insertFromLuna}
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={(mode === "reply" && uploading) || isSending}
            title={mode === "reply" && uploading ? "Waiting for the upload to finish…" : "Ctrl+Enter to send"}
            className="h-9 gap-2 rounded-lg bg-social-orange px-4 text-[13px] font-semibold text-slate-900 hover:bg-social-orange/90"
            data-testid="conversation-send"
          >
            {isSending || (mode === "reply" && uploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {mode === "note" ? "Add note" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
