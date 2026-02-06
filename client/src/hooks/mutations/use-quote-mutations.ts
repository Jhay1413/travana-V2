import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import { quoteKeys } from "@/hooks/queries";
import type { CreateQuoteData } from "@/types/quote";

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuoteData) => quoteApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) => quoteApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}
