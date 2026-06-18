import { useMutation, useQueryClient } from "@tanstack/react-query";
import { branchApi, type BranchInput } from "./branch.api";
import { branchKeys } from "./use-branch-queries";

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BranchInput) => branchApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.list() }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchInput }) => branchApi.update(id, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: branchKeys.list() });
      qc.invalidateQueries({ queryKey: branchKeys.detail(vars.id) });
    },
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: branchKeys.list() }),
  });
}
