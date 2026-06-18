import { useMutation, useQueryClient } from "@tanstack/react-query";
import { airportApi } from "./airport.api";
import { airportKeys } from "./use-airport-queries";

export function useCreateAirport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { airport_name: string; airport_code: string; country_id?: string }) =>
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
