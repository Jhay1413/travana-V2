import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tourOperatorApi } from "@/api";
import { tourOperatorKeys } from "@/hooks/queries";
import type { TourOperator } from "@/types/tour-operator";

export function useCreateTourOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<TourOperator, "id" | "createdAt" | "updatedAt">) =>
      tourOperatorApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tourOperatorKeys.lists() });
    },
  });
}

export function useUpdateTourOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TourOperator> }) =>
      tourOperatorApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tourOperatorKeys.lists() });
    },
  });
}

export function useDeleteTourOperator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tourOperatorApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tourOperatorKeys.lists() });
    },
  });
}
