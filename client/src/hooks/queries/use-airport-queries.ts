import { useQuery } from "@tanstack/react-query";
import { airportApi } from "@/api";
import type { Airport } from "@/types/airport";

export const airportKeys = {
  all: ["airports"] as const,
  lists: () => [...airportKeys.all, "list"] as const,
  list: () => [...airportKeys.lists()] as const,
  byCountries: (countryIds: string[]) => [...airportKeys.lists(), "countries", [...countryIds].sort().join(",")] as const,
};

export function useAirports() {
  return useQuery<Airport[]>({
    queryKey: airportKeys.list(),
    queryFn: () => airportApi.getAll(),
  });
}

export function useAirportsByCountries(countryIds: string[]) {
  return useQuery<Airport[]>({
    queryKey: airportKeys.byCountries(countryIds),
    queryFn: () => airportApi.getAll(countryIds),
    enabled: countryIds.length > 0,
  });
}
