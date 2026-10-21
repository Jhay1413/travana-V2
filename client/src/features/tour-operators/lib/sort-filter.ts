import { rateOf } from "./summary";
import type { OrgOperatorRow, SortKey, SortState } from "../types";

export const DEFAULT_SORT: SortState = { key: "name", dir: 1 };

/** Case-insensitive match on name, phone, website or username. */
export function filterOperators(rows: OrgOperatorRow[], query: string): OrgOperatorRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => [r.name, r.phone, r.website, r.username].some((v) => (v ?? "").toLowerCase().includes(q)));
}

/** Sorts a copy. Operators with no rate always go last, whichever way the rate sorts. */
export function sortOperators(rows: OrgOperatorRow[], sort: SortState): OrgOperatorRow[] {
  const byName = (a: OrgOperatorRow, b: OrgOperatorRow) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  return [...rows].sort((a, b) => {
    if (sort.key === "name") return byName(a, b) * sort.dir;
    const ra = rateOf(a);
    const rb = rateOf(b);
    if (ra === null && rb === null) return byName(a, b);
    if (ra === null) return 1;
    if (rb === null) return -1;
    return (ra - rb) * sort.dir || byName(a, b);
  });
}

/** Same column reverses; a new column starts ascending. */
export function nextSort(current: SortState, key: SortKey): SortState {
  return current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 };
}
