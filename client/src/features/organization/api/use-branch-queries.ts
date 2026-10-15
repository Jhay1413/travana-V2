import { useQuery } from "@tanstack/react-query";
import { branchApi, type Branch, type BranchType } from "./branch.api";

export const branchKeys = {
  all: ["branches"] as const,
  // No type = prefix matching every list (used for invalidation).
  list: (type?: BranchType) => (type ? ([...branchKeys.all, "list", type] as const) : ([...branchKeys.all, "list"] as const)),
  detail: (id: string) => [...branchKeys.all, "detail", id] as const,
};

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: branchKeys.list("shop"),
    queryFn: () => branchApi.list("shop"),
  });
}

/** Homeworker branches (admin-only on the server). Pass enabled=false for non-admins. */
export function useHomeworkerBranches(options?: { enabled?: boolean }) {
  return useQuery<Branch[]>({
    queryKey: branchKeys.list("homeworker"),
    queryFn: () => branchApi.list("homeworker"),
    enabled: options?.enabled ?? true,
  });
}

export function useBranch(id: string | null | undefined) {
  return useQuery<Branch>({
    queryKey: branchKeys.detail(id ?? ""),
    queryFn: () => branchApi.getById(id as string),
    enabled: !!id,
  });
}
