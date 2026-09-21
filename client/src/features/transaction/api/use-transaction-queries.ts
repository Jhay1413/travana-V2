import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { transactionApi } from "@/api";
import type { Transaction } from "@/features/quote/types";

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters?: any) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, "detail"] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  detailWithRelations: (id: string) => [...transactionKeys.details(), id, "with-details"] as const,
  stats: () => [...transactionKeys.all, "stats"] as const,
  pipeline: (status: string, agentId?: string, quoteStatus?: string, sort?: string) => [...transactionKeys.all, "pipeline", status, agentId, quoteStatus, sort] as const,
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

export function usePipelineColumn(status: PipelineColumnStatus, limit: number = 10, agentId?: string, quoteStatus?: string, options?: { enabled?: boolean }, sort?: "newest" | "oldest" | "oldest-activity") {
  return useInfiniteQuery({
    queryKey: transactionKeys.pipeline(status, agentId, quoteStatus, sort),
    queryFn: ({ pageParam = 1 }) =>
      transactionApi.getPipelineByStatus(status, pageParam as number, limit, agentId, quoteStatus, sort),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: options?.enabled ?? true,
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
