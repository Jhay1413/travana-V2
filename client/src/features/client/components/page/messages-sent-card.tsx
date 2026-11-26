import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { MESSAGE_LOG_EMPTY_TEXT, MessageLogList, MessageLogSheet, useMessageLogPreview } from "@/features/customer-messaging";
import { CARD_CLASS, CardHead } from "./card-head";

const PREVIEW_LIMIT = 5;

/** "Messages sent": the latest 5 messages sent to this customer, with "View all" opening the full, paged list. Read-only. */
export function MessagesSentCard({ clientId }: { clientId: string }) {
  const { data, isLoading, isError } = useMessageLogPreview(clientId, PREVIEW_LIMIT);
  const [open, setOpen] = useState(false);
  const items = data?.items ?? [];

  return (
    <section className={CARD_CLASS} data-testid="card-messages-sent">
      <CardHead title="Messages sent" icon={MessageSquare} />
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-muted" data-testid="messages-sent-loading" />
      ) : isError ? (
        <p className="text-[13px] text-destructive" data-testid="messages-sent-error">
          Could not load the messages.
        </p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-social-muted" data-testid="messages-sent-empty">
          {MESSAGE_LOG_EMPTY_TEXT}
        </p>
      ) : (
        <MessageLogList entries={items} testId="messages-sent-list" />
      )}
      {data?.nextCursor && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-[13px] font-semibold text-social-orange-text transition hover:underline"
          data-testid="button-view-all-messages"
        >
          View all
        </button>
      )}
      <MessageLogSheet clientId={clientId} open={open} onOpenChange={setOpen} />
    </section>
  );
}
