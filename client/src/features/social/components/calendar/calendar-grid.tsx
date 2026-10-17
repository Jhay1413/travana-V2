import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { EnrichedQuote } from "@/features/quote/types";
import { DOW, MONTHS, buildMonthCells, buildWeekCells, groupByDay } from "../../lib/calendar-grid";
import { CalendarPostChip } from "./calendar-post-chip";
import { localYmd, type CalendarMode } from "./calendar-range";
import { todayYmd } from "./use-calendar-drop";

interface CalendarGridProps {
  mode: CalendarMode;
  /** "YYYY-MM" for month mode. */
  month: string;
  /** Monday "YYYY-MM-DD" for week mode. */
  weekStartIso: string;
  quotes: readonly EnrichedQuote[];
  isDroppable: (ymd: string) => boolean;
  onDropOnDay: (ymd: string, quoteId: string) => void;
  onOpenPost: (quote: EnrichedQuote) => void;
  onShowWeek: (ymd: string) => void;
}

const MAX_CHIPS = 2;

export function CalendarGrid({
  mode,
  month,
  weekStartIso,
  quotes,
  isDroppable,
  onDropOnDay,
  onOpenPost,
  onShowWeek,
}: CalendarGridProps) {
  const [overIso, setOverIso] = useState<string | null>(null);
  const week = mode === "week";
  const today = todayYmd();
  const cells = useMemo(
    () => (week ? buildWeekCells(weekStartIso) : buildMonthCells(month)),
    [week, month, weekStartIso],
  );
  const byDay = useMemo(
    () => groupByDay(quotes, (q) => (q.postSchedule ? localYmd(q.postSchedule) : null)),
    [quotes],
  );

  return (
    <div role="grid" aria-label="Post calendar" className="flex flex-col">
      <div role="row" className="grid grid-cols-7 border-b border-social-border">
        {DOW.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-social-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const items = byDay.get(cell.iso) ?? [];
          const shown = week ? items : items.slice(0, MAX_CHIPS);
          const hidden = items.length - shown.length;
          const isToday = cell.iso === today;
          const highlighted = overIso === cell.iso;
          return (
            <div
              key={cell.iso}
              role="gridcell"
              aria-label={cell.iso}
              onDragOver={(e) => {
                if (!isDroppable(cell.iso)) return;
                e.preventDefault();
                setOverIso(cell.iso);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setOverIso((cur) => (cur === cell.iso ? null : cur));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverIso(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDropOnDay(cell.iso, id);
              }}
              className={cn(
                "flex flex-col gap-1 border-b border-r border-social-border p-1.5",
                week ? "min-h-80" : "min-h-[112px]",
                !week && !cell.inMonth && "bg-muted/40",
                highlighted && "bg-amber-50 dark:bg-amber-950/40 ring-2 ring-inset ring-amber-300",
              )}
            >
              <div className="flex items-center">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium",
                    isToday ? "bg-social-orange text-white" : cell.inMonth || week ? "text-social-navy" : "text-social-muted",
                  )}
                >
                  {cell.day === 1 ? `1 ${MONTHS[Number(cell.iso.slice(5, 7)) - 1].slice(0, 3)}` : cell.day}
                </span>
              </div>
              {shown.map((q) => (
                <CalendarPostChip key={q.id} quote={q} large={week} onOpen={onOpenPost} />
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => onShowWeek(cell.iso)}
                  className="text-left text-[11px] font-medium text-social-muted hover:text-social-navy hover:underline"
                >
                  +{hidden} more
                </button>
              )}
              {highlighted && (
                <div className="mt-auto rounded-md border border-dashed border-amber-400 py-2 text-center text-[11px] font-medium text-amber-700">
                  Drop to schedule
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
