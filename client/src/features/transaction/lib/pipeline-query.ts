import type { DealPriority, PipelineQueryFilters } from "../api/transaction.api";

function uniqueSorted<T extends string>(values: readonly T[] | undefined): T[] | undefined {
  if (!values) return undefined;
  const cleaned = Array.from(new Set(values.map((v) => v.trim()).filter((v) => v.length > 0))) as T[];
  if (cleaned.length === 0) return undefined;
  return cleaned.sort();
}

/** Canonical form of the pipeline filters: trimmed search, sorted de-duplicated
 *  arrays, empty values dropped. Returns undefined when nothing is set so query
 *  keys and URLs stay identical to the unfiltered ones. */
export function normalizePipelineFilters(filters?: PipelineQueryFilters): PipelineQueryFilters | undefined {
  if (!filters) return undefined;
  const search = filters.search?.trim();
  const priority = uniqueSorted<DealPriority>(filters.priority);
  const tourOperatorId = uniqueSorted<string>(filters.tourOperatorId);
  const out: PipelineQueryFilters = {};
  if (search) out.search = search;
  if (priority) out.priority = priority;
  if (tourOperatorId) out.tourOperatorId = tourOperatorId;
  if (filters.quick) out.quick = filters.quick;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Appends the (normalised) filters to a URLSearchParams, CSV-joining arrays. */
export function appendPipelineFilterParams(params: URLSearchParams, filters?: Omit<PipelineQueryFilters, "quick"> & { quick?: PipelineQueryFilters["quick"] }): void {
  const f = normalizePipelineFilters(filters);
  if (!f) return;
  if (f.search) params.append("search", f.search);
  if (f.priority) params.append("priority", f.priority.join(","));
  if (f.tourOperatorId) params.append("tourOperatorId", f.tourOperatorId.join(","));
  if (f.quick) params.append("quick", f.quick);
}
