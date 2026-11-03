import { ListFilter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AMBER_LINK } from "@/features/pipeline/shared/button-styles";
import { FilterChip } from "@/features/pipeline/shared/filter-chip";
import { TICKET_PRIORITIES, TICKET_TYPES } from "../../types";
import { activeFilterCount, type QueueFilters } from "../../lib/ticket-queue";
import { priorityMeta } from "../../lib/ticket-display";

const LABEL = "mb-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Filters button with a popover: priority and kind chips plus "Clear filters". */
export function FiltersPopover({ filters, onChange }: { filters: QueueFilters; onChange: (next: QueueFilters) => void }) {
  const count = activeFilterCount(filters);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-[120px] shrink-0 items-center gap-2 rounded-[10px] border border-social-border bg-card pl-3 text-[12px] font-medium xl:w-[130px] xl:text-[13px]"
          data-testid="button-ticket-filters"
        >
          <ListFilter className="h-[15px] w-[15px] text-social-muted" />
          <span className="flex-1 text-left">Filters{count ? ` ${count}` : ""}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] rounded-xl border-social-border p-3">
        <div className={LABEL}>Priority</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TICKET_PRIORITIES.map((p) => (
            <FilterChip
              key={p}
              active={filters.priorities.includes(p)}
              onClick={() => onChange({ ...filters, priorities: toggle(filters.priorities, p) })}
              testId={`chip-priority-${p}`}
            >
              {priorityMeta(p).label}
            </FilterChip>
          ))}
        </div>
        <div className={LABEL}>Kind of ticket</div>
        <div className="flex flex-wrap gap-1.5">
          {TICKET_TYPES.map((k) => (
            <FilterChip
              key={k}
              active={filters.kinds.includes(k)}
              onClick={() => onChange({ ...filters, kinds: toggle(filters.kinds, k) })}
              testId={`chip-kind-${k}`}
            >
              {k}
            </FilterChip>
          ))}
        </div>
        {count > 0 && (
          <button
            type="button"
            className={`mt-3 ${AMBER_LINK} text-[12.5px]`}
            onClick={() => onChange({ priorities: [], kinds: [] })}
            data-testid="button-clear-ticket-filters"
          >
            Clear filters
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
