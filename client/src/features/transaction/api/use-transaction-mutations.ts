import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transactionApi } from "@/api";
import { transactionKeys, quoteKeys } from "@/hooks/queries";
import { referralKeys } from "@/features/referral/api/use-referral-queries";
import type { CreateTransactionData } from "@/features/quote/types";

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionData) => transactionApi.create(data),
    onSuccess: () => {
      // Invalidate ALL transaction queries (not just lists()) so the pipeline
      // columns refresh too — their key is ["transactions","pipeline",...],
      // which lists() = ["transactions","list"] does not match by prefix.
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: referralKeys.all });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransactionData> }) =>
      transactionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionApi.delete(id),
    onSuccess: () => {
      // Invalidate ALL transaction queries so pipeline columns refresh too
      // (see useCreateTransaction note re: lists() vs pipeline key prefixes).
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
