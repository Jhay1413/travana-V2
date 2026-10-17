import { useQuery } from "@tanstack/react-query";
import { targetsYearApi } from "./targets.api";
import type { TargetsYear } from "../types";

export const targetsYearKeys = {
  /** Shares the "targets" root with the older report queries, so one invalidate refreshes both. */
  all: ["targets", "year"] as const,
  year: (year: number) => ["targets", "year", year] as const,
};

/** Everything the Targets pages show for one year, trimmed by the server to what the caller may see. */
export function useTargetsYear(year: number, options?: { enabled?: boolean }) {
  return useQuery<TargetsYear>({
    queryKey: targetsYearKeys.year(year),
    queryFn: () => targetsYearApi.getYear(year),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}
