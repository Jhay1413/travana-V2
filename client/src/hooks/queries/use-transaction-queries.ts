import { useQuery } from "@tanstack/react-query";
import { transactionApi } from "@/api";
import type { Transaction } from "@/types/quote";

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters?: any) => [...transactionKeys.lists(), filters] as const,
  details: () => [...transactionKeys.all, "detail"] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  stats: () => [...transactionKeys.all, "stats"] as const,
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

export function useTransactionStats() {
  return useQuery({
    queryKey: transactionKeys.stats(),
    queryFn: () => transactionApi.getStats(),
  });
}
