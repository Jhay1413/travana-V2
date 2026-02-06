import { useQuery } from "@tanstack/react-query";
import { airportApi } from "@/api";
import type { Airport } from "@/types/airport";

export const airportKeys = {
  all: ["airports"] as const,
  lists: () => [...airportKeys.all, "list"] as const,
  list: () => [...airportKeys.lists()] as const,
};

export function useAirports() {
  return useQuery<Airport[]>({
    queryKey: airportKeys.list(),
    queryFn: airportApi.getAll,
  });
}
