import type { DealPriority, PipelineQueryFilters, PipelineSort } from "@/features/transaction";
import type { PipelineStage } from "./pipeline-helpers";
import { isOpenStage } from "./pipeline-stage-style";

export const DEFAULT_PIPELINE_SORT: PipelineSort = "latest_activity";

export const PIPELINE_SORT_OPTIONS: Array<{ value: PipelineSort; label: string }> = [
  { value: "latest_activity", label: "Latest activity" },
  { value: "value_desc", label: "Value, high to low" },
  { value: "profit_desc", label: "Profit, high to low" },
  { value: "quiet_first", label: "Quietest first" },
  { value: "name_asc", label: "Deal name" },
];

export function sortLabel(sort: PipelineSort): string {
  return PIPELINE_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? "Latest activity";
}

/** Returns a new Set with `value` added or removed. */
export function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Number of active popover filters (priorities + tour operators). */
export function activeFilterCount(priority: ReadonlySet<DealPriority>, operators: ReadonlySet<string>): number {
  return priority.size + operators.size;
}

export function hasActiveFilters(filters: PipelineQueryFilters): boolean {
  return !!(filters.search?.trim() || filters.priority?.length || filters.tourOperatorId?.length || filters.quick);
}

/** Filters for one board column. The quick chip applies to the OPEN columns
 *  only; while a chip is active Booked / Future / Lost are not queried at all
 *  (`enabled: false`) and render their empty state. */
export function columnFiltersFor(
  stage: PipelineStage,
  filters: PipelineQueryFilters,
): { enabled: boolean; filters: PipelineQueryFilters } {
  if (isOpenStage(stage)) return { enabled: true, filters };
  const { quick, ...rest } = filters;
  return { enabled: !quick, filters: rest };
}
