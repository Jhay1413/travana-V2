import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enquiryApi } from "@/api";
import { enquiryKeys } from "@/hooks/queries";
import type { CreateEnquiryData } from "@/types/enquiry";

export function useCreateEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEnquiryData) => enquiryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryKeys.lists() });
    },
  });
}

export function useUpdateEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEnquiryData> }) => enquiryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryKeys.all });
    },
  });
}

export function useDeleteEnquiry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => enquiryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enquiryKeys.lists() });
    },
  });
}
