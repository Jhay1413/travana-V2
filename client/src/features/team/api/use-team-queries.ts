import { useQuery } from "@tanstack/react-query";
import { teamApi } from "./team.api";
import type { MemberWorkload } from "../types";

export const teamKeys = {
  all: ["team"] as const,
  workload: (userId: string) => [...teamKeys.all, "workload", userId] as const,
};

/** Open work a member holds, shown in the Remove dialog. Always fresh: it decides who must take over. */
export function useMemberWorkload(userId: string | null) {
  return useQuery<MemberWorkload>({
    queryKey: teamKeys.workload(userId ?? ""),
    queryFn: () => teamApi.getWorkload(userId as string),
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
  });
}
