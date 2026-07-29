import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, Loader2, MessageSquare, Send, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CHANNELS,
  DayDivider,
  MessageBubble,
  dayLabel,
  groupMessagesByDay,
  toUiConversation,
  toUiMessage,
  useClientContactLink,
  useConversations,
  useCreateInternalNote,
  useMessages,
  useSendMessage,
} from "@/features/conversations";
import type { Conversation, ConversationMessage } from "@/features/conversations";

// A client's SendSeven conversations on the client dashboard. Resolves the
// client → SendSeven contact link, lists that contact's threads, and renders the
// selected thread with a reply/note composer. A contact has one thread per
// channel (plus any closed ones kept for history), so several rows is normal.

const COMPOSER_MAX_HEIGHT_PX = 160;

function EmptyState({ icon: Icon, title, hint, action }: {
  icon: typeof MessageSquare;
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/60 py-10 text-center">
      <Icon className="mx-auto mb-2 h-8 w-8 text-black/20" />
      <p className="text-sm font-medium text-black/50">{title}</p>
      <p className="mt-1 text-xs text-black/35">{hint}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const meta = CHANNELS[conversation.channel];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`client-chat-row-${conversation.id}`}
      className={cn(
        // shrink-0 keeps rows at their natural height inside the scrolling
        // column — without it they compress into each other as the list grows.
        "flex w-full shrink-0 items-start gap-2.5 rounded-2xl border p-2.5 text-left transition",
        active
          ? "border-black/20 bg-white shadow-sm"
          : "border-black/10 bg-white/70 hover:border-black/20 hover:bg-white",
      )}
    >
      <span className={cn("mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full", meta.badge)}>
        <Icon className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-black/80">{meta.label}</span>
          {conversation.unread && <span className="h-1.5 w-1.5 flex-none rounded-full bg-sky-500" />}
          <span
            className={cn(
              "ml-auto inline-flex flex-none items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
              conversation.status === "closed"
                ? "border-slate-300 bg-slate-100 text-slate-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
          >
            {conversation.status === "closed" ? "Closed" : "Open"}
          </span>
        </div>
        {/* Two clamped lines rather than one truncated one — a preview squeezed
            next to the date was unreadable at this column width. */}
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-black/50">
          {conversation.preview || "No messages yet"}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-black/35">
          {dayLabel(conversation.lastActivityAt)}
        </p>
      </div>
    </button>
  );
}

// Compact reply/note box. Leaner than the inbox composer — no bot, translate or
// attachment controls — but it posts to the same messages endpoints.
function ChatComposer({
  mode,
  setMode,
  onSend,
  sending,
}: {
  mode: "reply" | "note";
  setMode: (m: "reply" | "note") => void;
  onSend: (body: string) => void;
  sending: boolean;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setText("");
  };

  // Auto-grow up to a max height as the message spans more lines, shrinking back
  // down after send resets `text`.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [text]);

  return (
    <div className="flex-none border-t border-black/10 px-3 py-2.5">
      <div className="mb-2 flex items-center gap-3">
        {(["reply", "note"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-lg px-2.5 py-0.5 text-xs font-semibold capitalize transition",
              mode === m
                ? m === "reply"
                  ? "bg-black text-white"
                  : "bg-amber-400/20 text-amber-700"
                : "text-black/45 hover:text-black",
            )}
            data-testid={`client-chat-mode-${m}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border px-3 py-1.5",
          mode === "note" ? "border-amber-400/40 bg-amber-400/5" : "border-black/10 bg-black/[0.02]",
        )}
      >
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={mode === "note" ? "Add an internal note…" : "Type a reply…"}
          rows={1}
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="client-chat-composer-input"
        />
        <Button
          type="button"
          onClick={submit}
          disabled={!text.trim() || sending}
          size="icon"
          className="mb-1 h-8 w-8 flex-none rounded-xl bg-black text-white hover:bg-black/85 disabled:opacity-40"
          data-testid="client-chat-send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ConversationThread({ conversation }: { conversation: Conversation }) {
  const { toast } = useToast();
  const { data, isLoading } = useMessages(conversation.id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"reply" | "note">("reply");
  // Locally-appended bubbles shown until the refetched thread contains them.
  const [optimistic, setOptimistic] = useState<ConversationMessage[]>([]);

  const sendMessage = useSendMessage(conversation.id);
  const createNote = useCreateInternalNote(conversation.id);
  const sending = sendMessage.isPending || createNote.isPending;

  // Drop optimistic bubbles when switching threads so they can't leak across.
  useEffect(() => setOptimistic([]), [conversation.id]);

  const messages = useMemo(
    () => [...(data?.items ?? []).map(toUiMessage), ...optimistic],
    [data, optimistic],
  );
  const grouped = useMemo(() => groupMessagesByDay(messages), [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation.id, messages.length]);

  const handleSend = (body: string) => {
    const isNote = mode === "note";
    const optimisticId = `opt-${conversation.id}-${new Date().getTime()}`;
    setOptimistic((prev) => [
      ...prev,
      {
        id: optimisticId,
        direction: "outbound",
        body,
        sentAt: new Date().toISOString(),
        authorName: "You",
        isNote,
      },
    ]);
    // On success the messages query refetches, so drop our copy to avoid dupes;
    // on failure drop it too and surface the error rather than showing a bubble
    // that was never delivered.
    const opts = {
      onSuccess: () => setOptimistic((prev) => prev.filter((m) => m.id !== optimisticId)),
      onError: (err: Error) => {
        setOptimistic((prev) => prev.filter((m) => m.id !== optimisticId));
        toast({
          title: isNote ? "Couldn't add note" : "Couldn't send message",
          description: err.message,
          variant: "destructive",
        });
      },
    };
    if (isNote) createNote.mutate({ conversation_id: conversation.id, text: body }, opts);
    else sendMessage.mutate({ conversation_id: conversation.id, message_type: "text", text: body }, opts);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* min-h-0 is required: without it this flex child refuses to shrink below
          its content, so a long thread spills out of the panel instead of
          scrolling inside it. */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-black/40">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-black/40">
            No messages yet — send the first one below
          </div>
        ) : (
          grouped.map((group, i) => (
            <div key={i} className="space-y-4">
              <DayDivider label={group.day} />
              {group.messages.map((m) => (
                <MessageBubble key={m.id} message={m} conversation={conversation} />
              ))}
            </div>
          ))
        )}
      </div>
      <ChatComposer mode={mode} setMode={setMode} onSend={handleSend} sending={sending} />
    </div>
  );
}

// Split out so the conversations query only ever runs with a real contact id —
// listing with no `contact_id` would return the whole org's inbox.
function LinkedContactChats({ contactId }: { contactId: string }) {
  const [, navigate] = useLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: list, isLoading: isLoadingList, isError: listFailed } = useConversations({ contactId, pageSize: 50 });

  // Newest thread first, so the most recent conversation opens by default.
  const conversations = useMemo(() => {
    const items = (list?.items ?? []).map(toUiConversation);
    return items.sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt));
  }, [list]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null,
    [conversations, selectedId],
  );

  if (isLoadingList) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-xs text-black/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading conversations…
      </div>
    );
  }

  if (listFailed) {
    return <EmptyState icon={MessageSquare} title="Couldn't load conversations" hint="The messaging service didn't respond. Try again shortly." />;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No conversations yet"
        hint="This client is linked to the inbox but hasn't messaged on any channel."
      />
    );
  }

  return (
    <div className="grid gap-3" data-testid="list-client-chats">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-black/45">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
          {conversations.length > 1 && (
            <p className="mt-0.5 text-[11px] text-black/35">
              One thread per channel, plus any closed threads kept for history.
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="flex-none gap-1.5 rounded-2xl text-xs"
          onClick={() => navigate("/conversations")}
          data-testid="button-client-chats-open-inbox"
        >
          <ArrowUpRight className="h-3.5 w-3.5" /> Open inbox
        </Button>
      </div>

      {/* Both panes share one fixed height and scroll independently, so the tab
          itself never grows a scrollbar no matter how many threads there are. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div className="flex max-h-56 min-h-0 flex-col gap-2 overflow-y-auto pr-1 lg:h-[34rem] lg:max-h-none">
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={selected?.id === c.id}
              onClick={() => setSelectedId(c.id)}
            />
          ))}
        </div>

        <div className="flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/70">
          {selected ? (
            <ConversationThread conversation={selected} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-black/40">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClientChatsTab({ clientId }: { clientId: string }) {
  const [, navigate] = useLocation();
  const { data: link, isLoading, isError } = useClientContactLink(clientId);
  const contactId = link?.contactId ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-xs text-black/40" data-testid="loading-client-chats">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking chat connection…
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Unplug}
        title="Couldn't load chats"
        hint="The chat connection couldn't be checked. Try again shortly."
      />
    );
  }

  if (!contactId) {
    return (
      <EmptyState
        icon={Unplug}
        title="Not connected to a conversation"
        hint="Link this client to a contact from the inbox to see their chat history here."
        action={
          <Button size="sm" variant="outline" className="gap-1.5 rounded-2xl text-xs" onClick={() => navigate("/conversations")}>
            <ArrowUpRight className="h-3.5 w-3.5" /> Open inbox
          </Button>
        }
      />
    );
  }

  return <LinkedContactChats contactId={contactId} />;
}
