import { useMutation, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/api";
import axiosClient from "@/api/client/axios-client";
import { QUOTE_ENDPOINTS } from "@/api/endpoints";
import { quoteKeys, transactionKeys, dashboardKeys } from "@/hooks/queries";
import type { CreateQuoteData } from "@/features/quote/types";

export function useSetPortalVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, showOnPortal }: { id: string; showOnPortal: boolean }) =>
      quoteApi.setPortalVisibility(id, showOnPortal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
    },
  });
}

export function useSetFeatured() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) => quoteApi.setFeatured(id, isFeatured),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
    },
  });
}

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
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> | FormData }) => quoteApi.update(id, data),
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
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: quoteKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: quoteKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}

export function useAdminDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, newPrimaryQuoteId }: { id: string; reason: string; newPrimaryQuoteId?: string }) =>
      axiosClient.post(`/api/v2/audit/delete-quote/${id}`, { reason, newPrimaryQuoteId }),
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

/** Manual "customer accepted" mark (true) or undo (false) on a quote. */
export function useMarkQuoteAccepted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, accepted }: { quoteId: string; accepted: boolean }) => {
      await axiosClient.patch(QUOTE_ENDPOINTS.accepted(quoteId), { accepted });
    },
    onSuccess: (_data, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(quoteId) });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
