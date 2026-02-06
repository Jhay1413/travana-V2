import { useMutation, useQueryClient } from "@tanstack/react-query";
import { airportApi } from "@/api";
import { airportKeys } from "@/hooks/queries";
import type { Airport } from "@/types/airport";

export function useCreateAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Airport, "id" | "createdAt">) =>
      airportApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airportKeys.lists() });
    },
  });
}

export function useDeleteAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => airportApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: airportKeys.lists() });
    },
  });
}
