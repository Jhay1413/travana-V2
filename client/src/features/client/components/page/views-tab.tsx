import { Eye } from "lucide-react";
import { useClientQuoteViews } from "@/features/quote";
import type { HolidaySelection } from "@/features/client/types";
import { longDate, relativeTime } from "@/features/client/lib/task-rows";

/** Which of the client's quotes they have opened, and how recently. */
export function ViewsTab({ clientId, onOpenDeal }: { clientId: string; onOpenDeal: (selection: HolidaySelection) => void }) {
  const { data: views, isLoading } = useClientQuoteViews(clientId);

  if (isLoading) return <p className="py-6 text-sm text-social-muted">Loading…</p>;
  if (!views || views.length === 0) {
    return <p className="border-t border-social-border py-6 text-sm text-social-muted">The client has not viewed any quotes yet.</p>;
  }

  return (
    <div data-testid="client-index-views">
      {views.map((v) => {
        const travel = longDate(v.travelDate);
        return (
          <button
            key={v.quoteId}
            type="button"
            onClick={() => onOpenDeal({ type: "quote", id: v.quoteId })}
            className="flex w-full items-center gap-3.5 border-t border-social-border py-4 text-left transition hover:bg-muted/50"
            data-testid={`client-index-view-${v.quoteId}`}
          >
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-status-posted-bg text-status-posted-fg">
              <Eye className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{v.title || "Untitled quote"}</div>
              <div className="mt-0.5 truncate text-xs text-social-muted">
                {[travel ? `Travel ${travel}` : null, v.lastDevice || null].filter(Boolean).join(" – ")}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold">
                {v.viewCount} {v.viewCount === 1 ? "view" : "views"}
              </div>
              <div className="text-xs text-social-muted">Last {relativeTime(v.lastViewedAt)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
