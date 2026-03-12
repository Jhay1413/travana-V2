import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import axiosClient from "@/api/client/axios-client";
import { quoteKeys, transactionKeys } from "@/hooks/queries";
import type { CreateQuoteData } from "@/types/quote";

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuoteData) => quoteApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useDuplicateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      quoteApi.duplicate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) => quoteApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quoteApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useAdminDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      axiosClient.post(`/api/audit/delete-quote/${id}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useUpdateQuoteTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => quoteApi.updateTags(id, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}
