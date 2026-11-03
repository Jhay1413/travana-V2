import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { targetsYearApi } from "./targets.api";
import { targetsYearKeys } from "./use-targets-queries";
import type { AllocationInput, MonthsInput, OverrideInput, TargetsYear } from "../types";

/** Refresh every Targets view, the older per-month queries and the dashboard tiles that read them. */
function refreshTargets(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["targets"] });
  qc.invalidateQueries({ queryKey: ["agent-stats"] });
}

export function useSaveBusinessTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MonthsInput) => targetsYearApi.saveBusiness(input),
    onSuccess: () => refreshTargets(qc),
  });
}

export function useSaveMyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MonthsInput) => targetsYearApi.saveMine(input),
    onSuccess: () => refreshTargets(qc),
  });
}

export function useSaveHomeworkerOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: OverrideInput & { userId: string }) => targetsYearApi.saveOverride(userId, input),
    onSuccess: () => refreshTargets(qc),
  });
}

export function useRevertHomeworkerOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, year }: { userId: string; year: number }) => targetsYearApi.revertOverride(userId, year),
    onSuccess: () => refreshTargets(qc),
  });
}

/** Saves business, shop and agent months in one request; the response is the fresh year. */
export function useSaveAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AllocationInput) => targetsYearApi.saveAllocation(input),
    onSuccess: (fresh: TargetsYear, input) => {
      qc.setQueryData(targetsYearKeys.year(input.year), fresh);
      refreshTargets(qc);
    },
  });
}
