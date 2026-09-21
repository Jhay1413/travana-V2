import { useMutation, useQueryClient } from "@tanstack/react-query";
import { destinationGuruApi } from "./destination-guru.api";
import { destinationGuruKeys } from "./use-destination-guru-queries";

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

export function useUpdateDestinationGuruCoordinates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, latitude, longitude }: { id: string; latitude: number; longitude: number }) =>
      destinationGuruApi.updateCoordinates(id, { latitude, longitude }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: destinationGuruKeys.all });
    },
  });
}
