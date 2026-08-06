import { useEffect, useRef, useState } from "react";
import { AlertTriangle, FlaskConical, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AssistantAvatar,
  ChatMessages,
  TypingDots,
  internalChatApi,
  useForkSession,
  useSendMessage,
  type ChatMessage,
} from "@/features/ai-chat";

// "Test AI" sandbox for a real conversation: the server forks the SendSeven
// conversation into a test_flow session (transcript + safe AI state copied,
// client cloned as a TEST twin), and the tester continues the thread AS the
// client. Everything runs against the internal-chat tables — nothing can
// reach the real customer or the live conversation's state. Each open forks a
// FRESH copy so the sandbox always reflects the conversation's latest state.

let localMsgSeq = 0;
const nextLocalId = (kind: string): string => `local-test-${kind}-${Date.now()}-${localMsgSeq++}`;

// Mirror the server's chatAttachmentUpload caps (files/size) — same limits the
// ChatWidget's test-flow picker uses. Images get the vision read (deal
// screenshots, holiday adverts, documents); PDFs skip vision but still reach
// a ticket as attached files.
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function TestAiModal({
  conversationId,
  open,
  onOpenChange,
}: {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  // File(s) to send with the next message — lets the tester replicate a
  // customer sending a deal screenshot / holiday advert / document, exercising
  // the same vision-triage + deal-detection path the live bot runs.
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  // Feedback when a picked file was rejected (wrong type / too big) — a
  // silently-vanishing file reads as a broken picker.
  const [attachError, setAttachError] = useState<string | null>(null);
  const [realNeedsHuman, setRealNeedsHuman] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const fork = useForkSession();
  const sendMessage = useSendMessage(sessionId);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesPicked = (picked: FileList | null) => {
    // Snapshot FIRST: `picked` is the input's LIVE FileList — resetting the
    // input below empties it, and React runs the state updater after this
    // handler, so reading it lazily would see zero files. (Same bug/fix as the
    // ChatWidget picker.)
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

  // Fork a fresh sandbox each time the modal opens; drop it on close so the
  // next open re-forks from the conversation's CURRENT transcript/state.
  useEffect(() => {
    if (!open) {
      setSessionId(null);
      setMessages([]);
      setInputText("");
      setAttachedFiles([]);
      setAttachError(null);
      setRealNeedsHuman(false);
      setForkError(null);
      return;
    }
    if (sessionId || fork.isPending) return;
    fork.mutate(conversationId, {
      onSuccess: async (res) => {
        setSessionId(res.sessionId);
        setRealNeedsHuman(res.realNeedsHuman);
        try {
          setMessages(await internalChatApi.getMessages(res.sessionId));
        } catch {
          // Seeded transcript failed to load — the session still works; the
          // tester just starts from a visually empty thread.
          setMessages([]);
        }
      },
      onError: (err) => setForkError((err as Error).message || "Couldn't set up the test session."),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, sendMessage.isPending]);

  const busy = sendMessage.isPending;

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !sessionId || busy) return;
    const files = attachedFiles;
    setInputText("");
    setAttachedFiles([]);
    setAttachError(null);
    setMessages((prev) => [
      ...prev,
      {
        id: nextLocalId("user"),
        sessionId,
        role: "user",
        // Show what was attached in the thread (the server transcript only
        // carries the text — the files go to vision triage, not the transcript).
        content: files.length ? `${text}\n${files.map((f) => `📎 ${f.name}`).join("\n")}` : text,
        createdAt: new Date().toISOString(),
      },
    ]);
    sendMessage.mutate(
      { text, files: files.length ? files : undefined },
      {
        onSuccess: (result) => {
          const reply: ChatMessage =
            result.kind === "assistant_reply"
              ? result.message
              : { id: nextLocalId("ai"), sessionId, role: "assistant", content: result.reply, createdAt: new Date().toISOString() };
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
      },
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[640px] max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-black/8 px-5 py-3.5 dark:border-white/8">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4 text-blue-600" />
            Test AI on this conversation
          </DialogTitle>
          <DialogDescription className="text-xs">
            You're chatting <span className="font-semibold">as the client</span> in a sandboxed copy — nothing reaches the
            real customer or the live conversation.
          </DialogDescription>
        </DialogHeader>

        {realNeedsHuman && (
          <div className="flex items-start gap-2 border-b border-amber-200/60 bg-amber-50 px-5 py-2 text-[11px] leading-snug text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              On the live conversation the AI is currently paused (an agent is handling it), so it would not actually
              reply right now. This sandbox ignores that so you can preview what it would say.
            </span>
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4 dark:bg-slate-950/40">
          {fork.isPending || (!sessionId && !forkError) ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Copying the conversation and generating the AI's reply…
            </div>
          ) : forkError ? (
            <div className="px-2 py-8 text-center text-sm text-destructive">{forkError}</div>
          ) : (
            <ChatMessages messages={messages} />
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

        <div className="border-t bg-white px-3 py-2.5 dark:bg-slate-900">
          {attachedFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5" data-testid="test-ai-attachments">
              {attachedFiles.map((f) => (
                <span
                  key={`${f.name}-${f.size}`}
                  className="flex max-w-50 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  title={f.name}
                >
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachedFiles((prev) => prev.filter((x) => x !== f))}
                    aria-label={`Remove ${f.name}`}
                    className="shrink-0 rounded hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {attachError && <div className="mb-2 text-[11px] text-destructive">{attachError}</div>}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              hidden
              onChange={(e) => handleFilesPicked(e.target.files)}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={!sessionId || busy || attachedFiles.length >= MAX_ATTACHMENTS}
              aria-label="Attach an image as the client"
              className="h-10 w-10 shrink-0 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedFiles.length ? "Add a message to send with the image…" : "Reply as the client…"}
              rows={1}
              className="max-h-32 min-h-[42px] flex-1 resize-none overflow-y-auto rounded-2xl"
              disabled={!sessionId || busy}
            />
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!inputText.trim() || !sessionId || busy}
              aria-label="Send as the client"
              className="h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
