import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrichedQuote } from "@/features/quote/types";
import { derivePostStatus } from "../../lib/post-status";
import { getFirstImage } from "../../lib/quote-card-fields";
import { chipTime } from "./calendar-range";

interface CalendarPostChipProps {
  quote: EnrichedQuote;
  large?: boolean;
  onOpen: (quote: EnrichedQuote) => void;
  onDragStart?: (quote: EnrichedQuote) => void;
  onDragEnd?: () => void;
}

export function CalendarPostChip({ quote, large = false, onOpen, onDragStart, onDragEnd }: CalendarPostChipProps) {
  const status = derivePostStatus(quote);
  const posted = status === "posted";
  const image = getFirstImage(quote);
  const size = large ? 30 : 22;
  const StatusIcon = posted ? CheckCircle2 : Clock;
  const time = quote.postSchedule ? chipTime(quote.postSchedule) : "";

  return (
    <button
      type="button"
      draggable={!posted}
      onClick={() => onOpen(quote)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", quote.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(quote);
      }}
      onDragEnd={onDragEnd}
      title={quote.title ?? undefined}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border text-left transition-shadow hover:shadow-sm",
        large ? "p-1.5" : "p-1",
        posted
          ? "border-status-posted-fg/20 bg-status-posted-bg"
          : "cursor-grab border-status-scheduled-fg/20 bg-status-scheduled-bg active:cursor-grabbing",
      )}
    >
      {image ? (
        <img
          src={image}
          alt=""
          style={{ width: size, height: size }}
          className="shrink-0 rounded object-cover"
          draggable={false}
        />
      ) : (
        <span style={{ width: size, height: size }} className="shrink-0 rounded bg-slate-200" />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium text-social-navy", large ? "text-sm" : "text-xs")}>
          {quote.title}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-[11px]",
            posted ? "text-status-posted-fg" : "text-status-scheduled-fg",
          )}
        >
          <StatusIcon className="h-3 w-3" aria-hidden="true" />
          {time}
        </span>
      </span>
    </button>
  );
}
