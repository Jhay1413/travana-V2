import { Info, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnrichedQuote } from "@/features/quote/types";
import { STATUS_META } from "../../lib/post-status";
import { getFirstImage, pricePerPersonLabel } from "../../lib/quote-card-fields";

interface UnscheduledTrayProps {
  drafts: readonly EnrichedQuote[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** Server-side draft count; the list itself may still be loading pages. */
  totalCount?: number;
  onOpenPost: (quote: EnrichedQuote) => void;
  onChangeTime: (quote: EnrichedQuote) => void;
}

export function UnscheduledTray({ drafts, isLoading, isError = false, onRetry, totalCount, onOpenPost, onChangeTime }: UnscheduledTrayProps) {
  return (
    <aside className="flex w-full flex-col rounded-2xl border border-social-border bg-card xl:w-[340px] xl:shrink-0">
      <div className="border-b border-social-border p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-social-navy">Not scheduled</h2>
          <span className="rounded-full bg-status-draft-bg px-2 py-0.5 text-xs font-medium text-status-draft-fg">
            {totalCount ?? drafts.length}
          </span>
        </div>
        <p className="mt-1 text-xs text-social-muted">Drag a draft onto a day, then pick the time.</p>
      </div>

      <div className="max-h-[560px] flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[76px] w-full rounded-lg" />)
        ) : isError ? (
          <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-red-600">Could not load drafts.</p>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : drafts.length === 0 ? (
          <p className="py-8 text-center text-sm text-social-muted">No drafts. New posts start here.</p>
        ) : (
          drafts.map((q) => {
            const image = getFirstImage(q);
            return (
              <div
                key={q.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", q.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="flex cursor-grab items-center gap-3 rounded-lg border border-social-border bg-card p-2 active:cursor-grabbing"
              >
                {image ? (
                  <img src={image} alt="" draggable={false} className="h-[60px] w-[76px] shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="h-[60px] w-[76px] shrink-0 rounded-md bg-slate-200" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-social-navy">{q.title}</p>
                  <p className="truncate text-xs text-social-muted">
                    {pricePerPersonLabel(q)}
                    {q.main_tour_operator_name ? ` · ${q.main_tour_operator_name}` : ""}
                  </p>
                  <Badge variant="secondary" className={`mt-1 ${STATUS_META.draft.badgeClass}`}>
                    {STATUS_META.draft.label}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Actions for ${q.title}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onChangeTime(q)}>Schedule…</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onOpenPost(q)}>Edit post</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-start gap-2 border-t border-social-border p-3 text-xs text-social-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Drafts never post. Only posts with a date and time go out.
      </div>
    </aside>
  );
}
