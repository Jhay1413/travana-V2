import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useMessageLogPages } from "../api/use-customer-messaging-staff";
import { formatLogRow } from "../lib/message-log-format";
import type { MessageLogEntry } from "../types";

export const MESSAGE_LOG_EMPTY_TEXT = "No automatic messages yet";

/** Rows like "Booking confirmation · WhatsApp · Sent · 24 Nov 14:02", with who sent it and the template underneath. */
export function MessageLogList({ entries, testId }: { entries: MessageLogEntry[]; testId: string }) {
  return (
    <ul className="divide-y divide-social-border" data-testid={testId}>
      {entries.map((entry) => {
        const row = formatLogRow(entry);
        return (
          <li key={entry.id} className="py-2.5" data-testid={`message-log-row-${entry.id}`}>
            <div className={cn("text-[13px]", row.sent ? "font-medium" : "text-social-muted")} data-testid="message-log-line">
              {row.line}
            </div>
            {row.detail && <div className="mt-0.5 text-[11px] text-social-muted">{row.detail}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Every message sent to one customer, newest first, 20 at a time. */
export function MessageLogSheet({ clientId, open, onOpenChange }: { clientId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const query = useMessageLogPages(clientId, open);
  const entries = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md" data-testid="messages-sent-sheet">
        <SheetHeader>
          <SheetTitle>Messages sent</SheetTitle>
          <SheetDescription>Every message sent to this customer, newest first.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {query.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          ) : query.isError ? (
            <p className="text-[13px] text-destructive">Could not load the messages.</p>
          ) : entries.length === 0 ? (
            <p className="text-[13px] text-social-muted">{MESSAGE_LOG_EMPTY_TEXT}</p>
          ) : (
            <MessageLogList entries={entries} testId="messages-sent-all" />
          )}
          {query.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-8 w-full rounded-lg text-[12px]"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
              data-testid="messages-sent-load-more"
            >
              {query.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
