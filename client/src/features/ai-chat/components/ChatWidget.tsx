import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRoles } from "@/hooks/use-role";
import { useCreateSession, useSendMessage } from "../api/use-internal-chat";
import { AssistantAvatar, ChatMessages, TypingDots } from "./ChatMessages";
import type { ChatMessage, ChatMode } from "../types";

const TEST_FLOW_ROLES = ["org_admin", "platform_admin"] as const;
const MAX_INPUT_HEIGHT = 160;

let localMsgSeq = 0;
const nextLocalId = (kind: string): string => `local-${kind}-${Date.now()}-${localMsgSeq++}`;

export function ChatWidget() {
  const { hasAnyRole } = useRoles();
  const canUseTestFlow = hasAnyRole([...TEST_FLOW_ROLES]);

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<ChatMode>("assistant");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  // Single source of truth for what's rendered. We append optimistically (the
  // user's message shows instantly) and append the reply on success — never
  // refetch mid-conversation, so nothing flickers or disappears.
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const createSession = useCreateSession();
  const sendMessage = useSendMessage(sessionId);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const startSession = (nextMode: ChatMode) => {
    setSessionId(null);
    setMessages([]);
    createSession.mutate(nextMode, {
      onSuccess: (res) => setSessionId(res.sessionId),
    });
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
    setInputText("");

    const userMessage: ChatMessage = {
      id: nextLocalId("user"),
      sessionId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    sendMessage.mutate(text, {
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
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something…"
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
