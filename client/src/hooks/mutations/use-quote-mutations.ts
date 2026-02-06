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
