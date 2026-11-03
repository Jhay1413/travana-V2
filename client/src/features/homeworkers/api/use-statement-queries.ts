import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";
import { HOMEWORKER_ENDPOINTS } from "@/api/endpoints";
import { homeworkerKeys } from "./use-homeworker-queries";
import type { FinalisedStatement, StatementResult } from "../statement-types";

export const statementKeys = {
  admin: (branchId: string, from: string, to: string) => [...homeworkerKeys.all, "statement", branchId, from, to] as const,
  mineAll: () => [...homeworkerKeys.all, "my-statement"] as const,
  mine: (from: string, to: string) => [...homeworkerKeys.all, "my-statement", from, to] as const,
};

export function useHomeworkerStatement(branchId: string | null, from: string, to: string) {
  return useQuery<StatementResult>({
    queryKey: statementKeys.admin(branchId ?? "", from, to),
    queryFn: async () => {
      const { data } = await axiosClient.get<StatementResult>(HOMEWORKER_ENDPOINTS.statement(branchId as string), {
        params: { from, to },
      });
      return data;
    },
    enabled: !!branchId,
  });
}

export function useMyHomeworkerStatement(from: string, to: string, options?: { enabled?: boolean }) {
  return useQuery<StatementResult>({
    queryKey: statementKeys.mine(from, to),
    queryFn: async () => {
      const { data } = await axiosClient.get<StatementResult>(HOMEWORKER_ENDPOINTS.meStatement, { params: { from, to } });
      return data;
    },
    enabled: options?.enabled ?? true,
    retry: false,
  });
}

export function useFinaliseStatement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ branchId, from, to }: { branchId: string; from: string; to: string }) => {
      const { data } = await axiosClient.post<FinalisedStatement>(HOMEWORKER_ENDPOINTS.finalise(branchId), { from, to });
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: statementKeys.admin(vars.branchId, vars.from, vars.to) });
      qc.invalidateQueries({ queryKey: statementKeys.mineAll() });
    },
  });
}
