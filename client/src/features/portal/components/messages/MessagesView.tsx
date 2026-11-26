import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { usePortalMessages, useSendMessage, type PortalMessage } from "@/hooks/use-portal-api";
import { canSend, groupMessagesByDay, mergeMessages } from "../../lib/messages";
import { prefillFromSearch } from "../../lib/message-prefill";
import { agentFirstName } from "../../lib/quote-format";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { Eyebrow, PortalButton } from "../brand";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";
import { MessagesPushPrompt, pushAvailable } from "./MessagesPushPrompt";

const NO_MESSAGES: PortalMessage[] = [];

/** The Messages tab: a chat that fills the space between the header and the tab bar, with the composer pinned at the bottom. */
export function MessagesView() {
  const { data: apiMessages, isLoading, isError, refetch } = usePortalMessages();
  const [sentHere, setSentHere] = useState<PortalMessage[]>([]);
  // Opened from a quote ("Ask Sam about this quote"): the composer starts with "About <quote title>: ".
  const [input, setInput] = useState(() => prefillFromSearch(window.location.search));
  const [pushEnabled, setPushEnabled] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const sendMutation = useSendMessage();
  const endRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const branding = usePortalBrandingValue();
  const agent = agentFirstName(branding.agentName);
  const agentLabel = agent === "your agent" ? "Your agent" : agent;

  useEffect(() => {
    if (!pushAvailable()) {
      setPushEnabled(false);
      return;
    }
    if (Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration("/portal-sw.js").then((reg) => {
        if (reg) reg.pushManager.getSubscription().then((sub) => setPushEnabled(!!sub));
        else setPushEnabled(false);
      });
    } else {
      setPushEnabled(false);
    }
  }, []);

  // A message still sending, or that failed, is always shown, whatever the server already has with the same text.
  const unsettled = new Set<string>(failedIds);
  if (sendingId) unsettled.add(sendingId);
  const allMessages = mergeMessages(apiMessages ?? NO_MESSAGES, sentHere, unsettled);
  const days = groupMessagesByDay(allMessages);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [allMessages.length, reduceMotion]);

  const deliver = async (message: PortalMessage) => {
    setSendingId(message.id);
    setFailedIds((prev) => {
      const next = new Set(prev);
      next.delete(message.id);
      return next;
    });
    try {
      await sendMutation.mutateAsync(message.text);
    } catch {
      setFailedIds((prev) => new Set(prev).add(message.id));
    } finally {
      setSendingId((current) => (current === message.id ? null : current));
    }
  };

  const handleSend = () => {
    if (!canSend(input, sendMutation.isPending)) return;
    const text = input.trim();
    setInput("");
    const message: PortalMessage = { id: "client-" + Date.now(), sender: "client", text, timestamp: new Date().toISOString() };
    setSentHere((prev) => [...prev, message]);
    void deliver(message);
  };

  const retry = (message: PortalMessage) => {
    if (sendMutation.isPending) return;
    void deliver(message);
  };

  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col"
      data-testid="portal-messages"
    >
      <div className="px-7 pb-3 pt-5">
        <Eyebrow>Messages</Eyebrow>
        <h1 className="portal-serif mt-1 max-w-full text-[30px] font-light leading-[1.1] text-primary [overflow-wrap:anywhere]" data-testid="text-messages-title">
          Chat with <em className="italic">{agent}</em>
        </h1>
      </div>

      {!pushEnabled && <MessagesPushPrompt onEnabled={() => setPushEnabled(true)} />}

      <div className="min-h-0 flex-1 overflow-y-auto px-7" role="log" aria-live="polite" aria-label="Conversation" data-testid="message-log">
        {isLoading ? (
          <MessagesLoading />
        ) : allMessages.length === 0 ? (
          isError ? (
            <div role="alert" className="flex h-full flex-col items-center justify-center py-10 text-center" data-testid="messages-error">
              <p className="portal-serif text-[26px] text-primary">We couldn&apos;t load your messages.</p>
              <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
              <PortalButton variant="outline" className="mt-5" onClick={() => void refetch()} data-testid="button-messages-retry">
                Try again
              </PortalButton>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <p className="portal-serif text-[28px] leading-tight text-primary" data-testid="text-empty-messages">
                No messages yet
              </p>
              <p className="mt-2 max-w-[300px] text-[15px] text-muted-foreground">
                Start a conversation with {agent === "your agent" ? "your travel agent" : agent}.
              </p>
            </div>
          )
        ) : (
          <>
            <MessageList days={days} agentName={agentLabel} sendingId={sendingId} failedIds={failedIds} onRetry={retry} />
            <div ref={endRef} />
          </>
        )}
      </div>

      <MessageComposer value={input} onChange={setInput} onSend={handleSend} sending={sendMutation.isPending} />
    </div>
  );
}

function MessagesLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4 py-4" role="status" aria-label="Loading your messages" data-testid="messages-loading">
      <div className="h-16 w-3/4 bg-secondary" />
      <div className="ml-auto h-12 w-2/3 bg-secondary" />
      <div className="h-20 w-3/4 bg-secondary" />
    </div>
  );
}
