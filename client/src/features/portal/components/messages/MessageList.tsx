import { cn } from "@/lib/utils";
import type { PortalMessage } from "@/hooks/use-portal-api";
import { formatTime, type MessageDay } from "../../lib/messages";

/** One bubble: the customer's in navy on the right, the agent's on sand on the left with the agent's name above. */
function Bubble({
  message,
  agentName,
  sending,
  failed,
  onRetry,
}: {
  message: PortalMessage;
  agentName: string;
  sending: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  const mine = message.sender === "client";
  return (
    <li className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")} data-testid={`message-${message.id}`}>
      {!mine && (
        <span className="portal-caps-label max-w-[85%] [overflow-wrap:anywhere]" data-testid={`text-agent-name-${message.id}`}>
          {message.agent_name || agentName}
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap px-[18px] py-4 text-sm leading-relaxed [overflow-wrap:anywhere]",
          mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        )}
        data-testid={`text-message-${message.id}`}
      >
        {message.text}
      </div>
      {failed ? (
        <span role="alert" className="flex items-center gap-3 text-[13px] portal-text-danger" data-testid={`message-failed-${message.id}`}>
          Not sent.
          <button type="button" onClick={onRetry} className="min-h-11 font-normal uppercase tracking-[0.18em] underline underline-offset-4" data-testid={`button-resend-${message.id}`}>
            Send again
          </button>
        </span>
      ) : sending ? (
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground" data-testid={`message-sending-${message.id}`}>
          Sending…
        </span>
      ) : (
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground" data-testid={`text-timestamp-${message.id}`}>
          {formatTime(message.timestamp)}
        </span>
      )}
    </li>
  );
}

/** The conversation, one hairline-headed group per day. */
export function MessageList({
  days,
  agentName,
  sendingId,
  failedIds,
  onRetry,
}: {
  days: MessageDay[];
  agentName: string;
  sendingId: string | null;
  failedIds: ReadonlySet<string>;
  onRetry: (message: PortalMessage) => void;
}) {
  return (
    <div className="flex flex-col gap-6 py-4">
      {days.map((day) => (
        <section key={day.key} aria-label={day.label || undefined} data-testid={`message-day-${day.key}`}>
          {day.label && (
            <div className="mb-4 flex items-center gap-4" role="separator" aria-label={day.label}>
              <span className="h-px flex-1 bg-border" aria-hidden />
              <span className="portal-caps-label" data-testid="message-day-label">
                {day.label}
              </span>
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
          )}
          <ul className="flex flex-col gap-4">
            {day.messages.map((m) => (
              <Bubble key={m.id} message={m} agentName={agentName} sending={sendingId === m.id} failed={failedIds.has(m.id)} onRetry={() => onRetry(m)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
