import { useQuery } from "@tanstack/react-query";
import { branchApi, type Branch } from "./branch.api";

export const branchKeys = {
  all: ["branches"] as const,
  list: () => [...branchKeys.all, "list"] as const,
  detail: (id: string) => [...branchKeys.all, "detail", id] as const,
};

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: branchKeys.list(),
    queryFn: branchApi.list,
  });
}

export function useBranch(id: string | null | undefined) {
  return useQuery<Branch>({
    queryKey: branchKeys.detail(id ?? ""),
    queryFn: () => branchApi.getById(id as string),
    enabled: !!id,
  });
}
