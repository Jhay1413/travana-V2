import { useCallback, useMemo, useState } from "react";
import type { OrgMember } from "@/features/organization/api/organization.api";
import {
  DEFAULT_FILTERS,
  applyNonStatusFilters,
  filterMembers,
  hasActiveFilters,
  statusCounts,
  type MemberFilters,
} from "../lib/member-filters";

/** Local filter state for the member table, plus the derived lists and tab counts. */
export function useTeamFilters(members: OrgMember[]) {
  const [filters, setFilters] = useState<MemberFilters>(DEFAULT_FILTERS);

  const patch = useCallback((next: Partial<MemberFilters>) => setFilters((f) => ({ ...f, ...next })), []);
  const clear = useCallback(() => setFilters((f) => ({ ...DEFAULT_FILTERS, status: f.status })), []);

  const visible = useMemo(() => filterMembers(members, filters), [members, filters]);
  // Tab counts follow the role/branch/search filters so the numbers match what each tab would show.
  const counts = useMemo(() => statusCounts(applyNonStatusFilters(members, filters)), [members, filters]);
  const roster = useMemo(() => statusCounts(members), [members]);

  return { filters, patch, clear, visible, counts, roster, filtered: hasActiveFilters(filters) };
}
