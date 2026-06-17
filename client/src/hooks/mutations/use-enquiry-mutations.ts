import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enquiryApi } from "@/api";
import { enquiryKeys, transactionKeys } from "@/hooks/queries";
import type { EnquiryTable } from "@/types/quote";

export function useCreateEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<EnquiryTable>) => enquiryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useUpdateEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof enquiryApi.update>[1] }) => enquiryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}

export function useDeleteEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enquiryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    },
  });
}
