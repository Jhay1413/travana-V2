import { useQuery, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { transactionApi } from "@/api";
import type { Transaction } from "@/features/quote/types";
import type { PipelineCountsParams, PipelineQueryFilters, PipelineSort } from "./transaction.api";
import { normalizePipelineFilters } from "../lib/pipeline-query";

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters?: any) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, "detail"] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  detailWithRelations: (id: string) => [...transactionKeys.details(), id, "with-details"] as const,
  stats: () => [...transactionKeys.all, "stats"] as const,
  // The normalised filters are appended ONLY when non-empty, so the legacy
  // (unfiltered) keys used by the dashboard panels stay identical.
  pipeline: (status: string, agentId?: string, quoteStatus?: string, sort?: string, branchId?: string, filters?: PipelineQueryFilters) => {
    const base = [...transactionKeys.all, "pipeline", status, agentId, quoteStatus, sort, branchId] as const;
    const normalized = normalizePipelineFilters(filters);
    return normalized ? ([...base, normalized] as const) : base;
  },
  pipelineCounts: (params: PipelineCountsParams) =>
    [
      ...transactionKeys.all,
      "pipeline-counts",
      { agentId: params.agentId, branchId: params.branchId, ...normalizePipelineFilters({ search: params.search, priority: params.priority, tourOperatorId: params.tourOperatorId }) },
    ] as const,
  expiringQuotes: (agentId?: string) => [...transactionKeys.all, "expiring-quotes", agentId] as const,
};

export function useTransactions(
  filters?: { clientId?: string; agentId?: string; dateFrom?: string; dateTo?: string; branchId?: string },
  options?: {
    enabled?: boolean;
    /** Override the 30s default — pass 0 for lists that must always show the latest deals. */
    staleTime?: number;
    refetchOnMount?: boolean | "always";
  },
) {
  return useQuery<Transaction[]>({
    queryKey: transactionKeys.list(filters),
    queryFn: () => transactionApi.getAll(filters),
    enabled: options?.enabled ?? true,
    ...(options?.staleTime !== undefined ? { staleTime: options.staleTime } : {}),
    ...(options?.refetchOnMount !== undefined ? { refetchOnMount: options.refetchOnMount } : {}),
  });
}

export function useTransaction(id: string) {
  return useQuery<Transaction>({
    queryKey: transactionKeys.detail(id),
    queryFn: () => transactionApi.getById(id),
    enabled: !!id,
  });
}

export function useTransactionDetails(id: string | null | undefined) {
  return useQuery<Transaction>({
    queryKey: transactionKeys.detailWithRelations(id ?? ""),
    queryFn: () => transactionApi.getWithDetails(id as string),
    enabled: !!id,
  });
}

export function usePipelineTransactions() {
  return useQuery<Transaction[]>({
    queryKey: [...transactionKeys.all, "pipeline"] as const,
    queryFn: () => transactionApi.getPipeline(),
  });
}

export type PipelineColumnStatus = "enquiry" | "quote" | "in_play" | "booking" | "future" | "lost";

export function usePipelineColumn(
  status: PipelineColumnStatus,
  limit: number = 10,
  agentId?: string,
  quoteStatus?: string,
  options?: { enabled?: boolean; keepPrevious?: boolean },
  sort?: PipelineSort,
  branchId?: string,
  filters?: PipelineQueryFilters,
) {
  return useInfiniteQuery({
    queryKey: transactionKeys.pipeline(status, agentId, quoteStatus, sort, branchId, filters),
    queryFn: ({ pageParam = 1 }) =>
      transactionApi.getPipelineByStatus(status, pageParam as number, limit, agentId, quoteStatus, sort, branchId, filters),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: options?.enabled ?? true,
    ...(options?.keepPrevious ? { placeholderData: keepPreviousData } : {}),
  });
}

export function usePipelineCounts(params: PipelineCountsParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: transactionKeys.pipelineCounts(params),
    queryFn: () => transactionApi.getPipelineCounts(params),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useTransactionStats() {
  return useQuery({
    queryKey: transactionKeys.stats(),
    queryFn: () => transactionApi.getStats(),
  });
}

export function useExpiringQuotes(agentId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: transactionKeys.expiringQuotes(agentId),
    queryFn: () => transactionApi.getExpiringQuotes(agentId),
    enabled: options?.enabled ?? true,
  });
}
