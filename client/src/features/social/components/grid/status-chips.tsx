import { cn } from "@/lib/utils";
import type { FreeQuoteStatusCounts } from "@/features/quote/api/quote.api";
import { STATUS_META } from "@/features/social/lib/post-status";
import { statusChipCount, type StatusFilter } from "./grid-filters";

interface StatusChipsProps {
  value: StatusFilter;
  counts: FreeQuoteStatusCounts | undefined;
  onChange: (value: StatusFilter) => void;
}

const CHIPS: { value: StatusFilter; label: string; count: (c: FreeQuoteStatusCounts) => number }[] = [
  { value: "all", label: "All", count: (c) => statusChipCount("all", c) },
  { value: "scheduled", label: STATUS_META.scheduled.plural, count: (c) => statusChipCount("scheduled", c) },
  { value: "draft", label: STATUS_META.draft.plural, count: (c) => statusChipCount("draft", c) },
  { value: "posted", label: STATUS_META.posted.plural, count: (c) => statusChipCount("posted", c) },
];

/** Pill buttons that filter by post status, each showing its count. */
export function StatusChips({ value, counts, onChange }: StatusChipsProps) {
  return (
    <div className="flex gap-2" role="group" aria-label="Filter by status">
      {CHIPS.map((chip) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
              active
                ? "border-[#1F2937] bg-[#1F2937] text-white dark:border-foreground dark:bg-foreground dark:text-background"
                : "border-social-border bg-card text-social-muted hover:bg-social-page",
            )}
            data-testid={`chip-status-${chip.value}`}
          >
            {chip.label}
            {counts && <> {chip.count(counts)}</>}
          </button>
        );
      })}
    </div>
  );
}
