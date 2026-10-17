import { useEffect, useMemo, useRef } from "react";
import { DayDivider, MessageBubble, groupMessagesByDay } from "../../message-thread";
import type { Conversation, ConversationMessage } from "../../../types";
import { TypingDots } from "./typing-dots";
import { useThreadScroll } from "./use-thread-scroll";

export interface MessageListProps {
  conversation: Conversation;
  messages: ConversationMessage[];
  isLoading: boolean;
  /** true = someone unnamed; a string is the typer's name. */
  typing: boolean | string;
}

export function MessageList({ conversation, messages, isLoading, typing }: MessageListProps) {
  const grouped = useMemo(() => groupMessagesByDay(messages), [messages]);
  const typingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typing) typingRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [typing]);
  const { threadScrollRef, handleThreadScroll } = useThreadScroll(conversation.id, messages.length);

  return (
    <div
      ref={threadScrollRef}
      onScroll={handleThreadScroll}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
      data-testid="conversation-thread"
    >
      {isLoading && messages.length === 0 ? (
        <div className="m-auto text-[13px] text-muted-foreground">Loading messages…</div>
      ) : messages.length === 0 ? (
        <div className="m-auto text-[13px] text-muted-foreground">No messages yet.</div>
      ) : (
        grouped.map((group) => (
          <div key={group.day} className="flex flex-col gap-3">
            <DayDivider label={group.day} variant="inbox" />
            {group.messages.map((m) => (
              <MessageBubble key={m.id} message={m} conversation={conversation} variant="inbox" />
            ))}
          </div>
        ))
      )}
      {typing && (
        <div ref={typingRef} className="flex justify-start" data-testid="conversation-typing">
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-[4px] border border-social-border bg-white px-3.5 py-3 dark:bg-card">
            <TypingDots />
            <span className="text-[12px] text-muted-foreground">
              {typeof typing === "string" && typing.trim() ? `${typing.trim()} is typing…` : "Typing…"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
