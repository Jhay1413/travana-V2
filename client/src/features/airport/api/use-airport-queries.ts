import { useQuery } from "@tanstack/react-query";
import { airportApi } from "./airport.api";
import type { Airport } from "../types";

export const airportKeys = {
  all: ["airports"] as const,
  lists: () => [...airportKeys.all, "list"] as const,
  list: () => [...airportKeys.lists()] as const,
  mostUsedDeparture: () => [...airportKeys.all, "most-used-departure"] as const,
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

/** Ids of the agency's most-used departure airports (most used first). Never blocks the picker: failures yield []. */
export function useMostUsedDepartureAirportIds() {
  return useQuery<string[]>({
    queryKey: airportKeys.mostUsedDeparture(),
    queryFn: () => airportApi.getMostUsedDepartureIds(),
    staleTime: 5 * 60 * 1000,
  });
}
