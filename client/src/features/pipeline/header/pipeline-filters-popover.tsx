import { ListFilter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTourOperators } from "@/features/tour-operator";
import type { DealPriority } from "@/features/transaction";
import { activeFilterCount } from "@/features/pipeline/lib/pipeline-board-filters";
import { PRIORITY_META, PRIORITY_OPTIONS } from "@/features/pipeline/lib/pipeline-helpers";
import { AMBER_LINK } from "@/features/pipeline/shared/button-styles";
import { FilterChip } from "@/features/pipeline/shared/filter-chip";

const LABEL = "mb-1.5 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";

/** Filters button with a popover: priority chips, tour-operator chips and "Clear filters". */
export function PipelineFiltersPopover({
  priority,
  operators,
  onTogglePriority,
  onToggleOperator,
  onClear,
}: {
  priority: ReadonlySet<DealPriority>;
  operators: ReadonlySet<string>;
  onTogglePriority: (p: DealPriority) => void;
  onToggleOperator: (id: string) => void;
  onClear: () => void;
}) {
  const { data: tourOperators = [] } = useTourOperators();
  const count = activeFilterCount(priority, operators);
  const options = tourOperators.filter((o) => !!o.name).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-[120px] shrink-0 items-center gap-2 rounded-[10px] border border-social-border bg-card pl-3 text-[12px] font-medium xl:w-[130px] xl:text-[13px]"
          data-testid="button-pipeline-filters"
        >
          <ListFilter className="h-[15px] w-[15px] text-social-muted" />
          <span className="flex-1 text-left">Filters{count ? ` ${count}` : ""}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] rounded-xl border-social-border p-3">
        <div className={LABEL}>Priority</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRIORITY_OPTIONS.map((p) => (
            <FilterChip key={p} active={priority.has(p)} onClick={() => onTogglePriority(p)} testId={`chip-priority-${p}`}>
              {PRIORITY_META[p].label}
            </FilterChip>
          ))}
        </div>
        <div className={LABEL}>Tour operator</div>
        <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
          {options.length === 0 && <span className="text-[12px] text-social-muted">No tour operators</span>}
          {options.map((o) => (
            <FilterChip key={o.id} active={operators.has(o.id)} onClick={() => onToggleOperator(o.id)} testId={`chip-operator-${o.id}`}>
              {o.name}
            </FilterChip>
          ))}
        </div>
        {count > 0 && (
          <button type="button" className={`mt-3 ${AMBER_LINK} text-[12.5px]`} onClick={onClear} data-testid="button-clear-filters">
            Clear filters
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
