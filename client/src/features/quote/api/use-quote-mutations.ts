import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import axiosClient from "@/api/client/axios-client";
import { quoteKeys, transactionKeys, dashboardKeys } from "@/hooks/queries";
import type { CreateQuoteData } from "@/features/quote/types";

export function useCreateSocialQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CreateQuoteData, 'transaction_id'> | FormData) => quoteApi.createSocialPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuoteData) => quoteApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
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
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
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
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
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
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useAdminDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      axiosClient.post(`/api/v2/audit/delete-quote/${id}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useSetPrimaryQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quoteId: string) => quoteApi.setPrimary(quoteId),
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
