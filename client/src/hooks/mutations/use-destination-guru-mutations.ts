import { useMutation, useQueryClient } from "@tanstack/react-query";
import { destinationGuruApi } from "@/api/endpoints/destination-guru.api";
import { destinationGuruKeys } from "@/hooks/queries/use-destination-guru-queries";

export function useGenerateDestinationGuru() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (destination: string) => destinationGuruApi.generate(destination),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: destinationGuruKeys.all });
    },
  });
}

export function useDeleteDestinationGuru() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => destinationGuruApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: destinationGuruKeys.all });
    },
  });
}
