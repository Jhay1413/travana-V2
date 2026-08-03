import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Paperclip, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRoles } from "@/hooks/use-role";
import { useCreateSession, useSendMessage } from "../api/use-internal-chat";
import { AssistantAvatar, ChatMessages, TypingDots } from "./ChatMessages";
import type { ChatMessage, ChatMode } from "../types";

const TEST_FLOW_ROLES = ["org_admin", "platform_admin"] as const;
const MAX_INPUT_HEIGHT = 160;
// Mirror the server's chatAttachmentUpload caps (files/size): up to 3 files,
// 10MB each. Images get the vision read; PDFs skip vision but still reach the
// ticket as attached files.
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

let localMsgSeq = 0;
const nextLocalId = (kind: string): string => `local-${kind}-${Date.now()}-${localMsgSeq++}`;

export function ChatWidget() {
  const { hasAnyRole } = useRoles();
  const canUseTestFlow = hasAnyRole([...TEST_FLOW_ROLES]);

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("assistant");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  // Test-flow only: file(s) to send with the next message, so a tester can
  // exercise the document-submission path (vision read → admin route → ticket).
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  // Feedback when a picked file was rejected (wrong type / too big) — a
  // silently-vanishing file reads as a broken picker.
  const [attachError, setAttachError] = useState<string | null>(null);
  // Single source of truth for what's rendered. We append optimistically (the
  // user's message shows instantly) and append the reply on success — never
  // refetch mid-conversation, so nothing flickers or disappears.
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const createSession = useCreateSession();
  const sendMessage = useSendMessage(sessionId);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startSession = (nextMode: ChatMode) => {
    setSessionId(null);
    setMessages([]);
    setAttachedFiles([]);
    setAttachError(null);
    createSession.mutate(nextMode, {
      onSuccess: (res) => setSessionId(res.sessionId),
    });
  };

  const handleFilesPicked = (picked: FileList | null) => {
    // Snapshot FIRST: `picked` is the input's LIVE FileList — resetting the
    // input below empties it, and React runs the state updater after this
    // handler, so reading it lazily would see zero files (the "attachment
    // never shows up" bug). The File objects themselves stay valid.
    const files = picked ? Array.from(picked) : [];
    // Reset so re-picking the same file fires onChange again.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!files.length) return;

    const rejections: string[] = [];
    setAttachedFiles((prev) => {
      const next = [...prev];
      for (const f of files) {
        const isSupported = f.type.startsWith("image/") || f.type === "application/pdf";
        if (!isSupported) {
          rejections.push(`${f.name}: only images and PDFs are supported`);
          continue;
        }
        if (f.size > MAX_ATTACHMENT_BYTES) {
          rejections.push(`${f.name}: over the 10MB limit`);
          continue;
        }
        if (next.length >= MAX_ATTACHMENTS) {
          rejections.push(`${f.name}: max ${MAX_ATTACHMENTS} files per message`);
          continue;
        }
        if (!next.some((existing) => existing.name === f.name && existing.size === f.size)) next.push(f);
      }
      return next;
    });
    setAttachError(rejections.length ? rejections.join(" · ") : null);
  };

  // Create the initial `assistant` session the first time the panel opens.
  useEffect(() => {
    if (isOpen && !sessionId && !createSession.isPending) {
      startSession(mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Keep the thread pinned to the latest message / typing indicator.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, sendMessage.isPending]);

  // Auto-grow the input with its content, up to a max height (then it scrolls).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [inputText]);

  const handleModeChange = (nextMode: string) => {
    if (!nextMode || (nextMode as ChatMode) === mode) return;
    setMode(nextMode as ChatMode);
    startSession(nextMode as ChatMode);
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !sessionId || sendMessage.isPending) return;
    const files = mode === "test_flow" ? attachedFiles : [];
    setInputText("");
    setAttachedFiles([]);
    setAttachError(null);

    const userMessage: ChatMessage = {
      id: nextLocalId("user"),
      sessionId,
      role: "user",
      // Show what was attached in the thread (the server transcript only
      // carries the text — the files go to the AI/ticket, not the transcript).
      content: files.length ? `${text}\n${files.map((f) => `📎 ${f.name}`).join("\n")}` : text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    sendMessage.mutate({ text, files: files.length ? files : undefined }, {
      onSuccess: (result) => {
        const reply: ChatMessage =
          result.kind === "assistant_reply"
            ? result.message
            : {
                id: nextLocalId("ai"),
                sessionId,
                role: "assistant",
                content: result.reply,
                createdAt: new Date().toISOString(),
              };
        setMessages((prev) => [...prev, reply]);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            id: nextLocalId("err"),
            sessionId,
            role: "assistant",
            content: "Sorry — something went wrong sending that. Please try again.",
            createdAt: new Date().toISOString(),
          },
        ]);
      },
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        type="button"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg hover:from-blue-700 hover:to-indigo-700"
        aria-label="Open AI assistant"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
    );
  }

  const busy = sendMessage.isPending;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex h-[560px] max-h-[80dvh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
      role="dialog"
      aria-label="AI assistant chat"
    >
      {/* Header */}
      <div className="relative flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_-20%,white,transparent_45%)]" />
        <AssistantAvatar className="h-9 w-9" />
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
            AI Assistant
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-blue-100">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400" />
            online
          </div>
        </div>
        {canUseTestFlow && (
          <ToggleGroup
            type="single"
            size="sm"
            value={mode}
            onValueChange={handleModeChange}
            className="relative rounded-full bg-white/10 p-0.5"
          >
            <ToggleGroupItem
              value="assistant"
              aria-label="Assistant mode"
              className="rounded-full px-2 text-xs text-white/80 data-[state=on]:bg-white data-[state=on]:text-blue-700"
            >
              Assistant
            </ToggleGroupItem>
            <ToggleGroupItem
              value="test_flow"
              aria-label="Test flow mode"
              className="rounded-full px-2 text-xs text-white/80 data-[state=on]:bg-white data-[state=on]:text-blue-700"
            >
              Test
            </ToggleGroupItem>
          </ToggleGroup>
        )}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => startSession(mode)}
            aria-label="Start a new chat"
            className="relative rounded-full px-2 py-1 text-[11px] font-medium text-blue-100 transition-colors hover:bg-white/15 hover:text-white"
          >
            New chat
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close AI assistant"
          className="relative rounded-full p-1 text-blue-100 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4 dark:bg-slate-950/40">
        {createSession.isPending && !messages.length ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : messages.length ? (
          <ChatMessages messages={messages} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-2 pt-6 text-center">
            <AssistantAvatar className="h-14 w-14" />
            <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              Hi! Ask me about your clients, quotes, bookings, or your numbers.
            </div>
          </div>
        )}

        {busy && (
          <div className="mt-4 flex items-end gap-2">
            <AssistantAvatar className="h-7 w-7" />
            <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-white px-3 py-2.5 dark:bg-slate-900">
        {mode === "test_flow" && attachError && (
          <div className="mb-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {attachError}
          </div>
        )}
        {mode === "test_flow" && attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachedFiles.map((f) => (
              <span
                key={`${f.name}-${f.size}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200"
              >
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFiles((prev) => prev.filter((x) => x !== f))}
                  aria-label={`Remove ${f.name}`}
                  className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          {mode === "test_flow" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFilesPicked(e.target.files)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={!sessionId || busy || attachedFiles.length >= MAX_ATTACHMENTS}
                aria-label="Attach an image or PDF (e.g. a passport photo) to test document submission"
                title="Attach an image or PDF to test document submission"
                className="h-10 w-10 shrink-0 rounded-2xl text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}
          <Textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "test_flow" && attachedFiles.length ? "Add a message to send with the file…" : "Ask something…"}
            rows={1}
            className="max-h-40 min-h-[42px] flex-1 resize-none overflow-y-auto rounded-2xl"
            disabled={!sessionId || createSession.isPending}
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!inputText.trim() || !sessionId || busy}
            aria-label="Send message"
            className="h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
