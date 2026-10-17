import { DatePicker } from "@/components/ui/date-picker";
import { FilterChip } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import type { TaskRangeFilter } from "../../lib/task-ranges";

export const FILTER_LABELS: Record<Exclude<TaskRangeFilter, "overdue">, string> = {
  all: "All",
  today: "Today",
  tomorrow: "Tomorrow",
  "this-week": "This week",
  custom: "Select date",
};

const FILTERS = ["all", "today", "tomorrow", "this-week", "custom"] as const;

/** Black-when-active chips, the red Overdue chip with its count, and the date picker for "Select date". */
export function TaskFilters({
  filter,
  onFilter,
  overdueCount,
  customDate,
  onCustomDate,
}: {
  filter: TaskRangeFilter;
  onFilter: (f: TaskRangeFilter) => void;
  overdueCount: number;
  customDate: string;
  onCustomDate: (v: string) => void;
}) {
  return (
    <div className="mb-2 mt-3 flex flex-wrap items-center gap-2" data-testid="dashboard-tasks-filters">
      {FILTERS.map((f) => (
        <FilterChip key={f} active={filter === f} onClick={() => onFilter(f)} testId={`button-tasks-filter-${f}`}>
          {FILTER_LABELS[f]}
        </FilterChip>
      ))}
      <button
        type="button"
        aria-pressed={filter === "overdue"}
        onClick={() => onFilter("overdue")}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors xl:px-3.5 xl:text-[13px]",
          filter === "overdue"
            ? "border-red-600 bg-red-600 text-white"
            : "border-red-600 bg-card text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
        )}
        data-testid="button-tasks-filter-overdue"
      >
        Overdue
        {overdueCount > 0 && (
          <span className="tabular-nums" data-testid="badge-tasks-overdue-count">
            {overdueCount}
          </span>
        )}
      </button>
      {filter === "custom" && (
        <DatePicker
          value={customDate}
          onChange={onCustomDate}
          placeholder="Pick a date"
          className="h-8 w-auto rounded-full text-[12px]"
          data-testid="input-tasks-filter-date"
        />
      )}
    </div>
  );
}
