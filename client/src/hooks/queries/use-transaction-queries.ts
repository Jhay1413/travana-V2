import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { transactionApi } from "@/api";
import type { Transaction } from "@/types/quote";

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters?: any) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, "detail"] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  stats: () => [...transactionKeys.all, "stats"] as const,
  pipeline: (status: string, agentId?: string, quoteStatus?: string) => [...transactionKeys.all, "pipeline", status, agentId, quoteStatus] as const,
};

export function useTransactions(filters?: { clientId?: string; agentId?: string }) {
  return useQuery<Transaction[]>({
    queryKey: transactionKeys.list(filters),
    queryFn: () => transactionApi.getAll(filters),
  });
}

export function useTransaction(id: string) {
  return useQuery<Transaction>({
    queryKey: transactionKeys.detail(id),
    queryFn: () => transactionApi.getById(id),
    enabled: !!id,
  });
}

export function usePipelineTransactions() {
  return useQuery<Transaction[]>({
    queryKey: [...transactionKeys.all, "pipeline"] as const,
    queryFn: () => transactionApi.getPipeline(),
  });
}

export function usePipelineColumn(status: string, limit: number = 10, agentId?: string, quoteStatus?: string) {
  return useInfiniteQuery({
    queryKey: transactionKeys.pipeline(status, agentId, quoteStatus),
    queryFn: ({ pageParam = 1 }) =>
      transactionApi.getPipelineByStatus(status, pageParam as number, limit, agentId, quoteStatus),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
  });
}

export function useTransactionStats() {
  return useQuery({
    queryKey: transactionKeys.stats(),
    queryFn: () => transactionApi.getStats(),
  });
}
