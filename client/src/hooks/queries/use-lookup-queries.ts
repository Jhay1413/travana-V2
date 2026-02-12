import { useQuery } from "@tanstack/react-query";
import { lookupApi } from "@/api/endpoints/lookup.api";

export const lookupKeys = {
  packageTypes: ["lookup", "package-types"] as const,
  countries: ["lookup", "countries"] as const,
  destinations: (countryId?: string) => ["lookup", "destinations", countryId] as const,
  allDestinations: ["lookup", "destinations", "all"] as const,
  resorts: (destinationId?: string) => ["lookup", "resorts", destinationId] as const,
  allResorts: ["lookup", "resorts", "all"] as const,
  accommodations: (resortId?: string) => ["lookup", "accommodations", resortId] as const,
  allAccommodations: ["lookup", "accommodations", "all"] as const,
  accommodationTypes: ["lookup", "accommodation-types"] as const,
  boardBasis: ["lookup", "board-basis"] as const,
  parks: ["lookup", "parks"] as const,
  lodges: (parkId?: string) => ["lookup", "lodges", parkId] as const,
  cottages: ["lookup", "cottages"] as const,
};

export function usePackageTypes() {
  return useQuery({
    queryKey: lookupKeys.packageTypes,
    queryFn: () => lookupApi.getPackageTypes(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: lookupKeys.countries,
    queryFn: () => lookupApi.getCountries(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useDestinations(countryId?: string) {
  return useQuery({
    queryKey: lookupKeys.destinations(countryId),
    queryFn: () => lookupApi.getDestinations(countryId),
    enabled: !!countryId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useResorts(destinationId?: string) {
  return useQuery({
    queryKey: lookupKeys.resorts(destinationId),
    queryFn: () => lookupApi.getResorts(destinationId),
    enabled: !!destinationId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useAccommodations(resortId?: string) {
  return useQuery({
    queryKey: lookupKeys.accommodations(resortId),
    queryFn: () => lookupApi.getAccommodations(resortId),
    enabled: !!resortId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useBoardBasis() {
  return useQuery({
    queryKey: lookupKeys.boardBasis,
    queryFn: () => lookupApi.getBoardBasis(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useParks() {
  return useQuery({
    queryKey: lookupKeys.parks,
    queryFn: () => lookupApi.getParks(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useLodges(parkId?: string) {
  return useQuery({
    queryKey: lookupKeys.lodges(parkId),
    queryFn: () => lookupApi.getLodges(parkId),
    enabled: !!parkId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useCottages() {
  return useQuery({
    queryKey: lookupKeys.cottages,
    queryFn: () => lookupApi.getCottages(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useAllDestinations() {
  return useQuery({
    queryKey: lookupKeys.allDestinations,
    queryFn: () => lookupApi.getDestinations(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useAllResorts() {
  return useQuery({
    queryKey: lookupKeys.allResorts,
    queryFn: () => lookupApi.getResorts(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useAccommodationTypes() {
  return useQuery({
    queryKey: lookupKeys.accommodationTypes,
    queryFn: () => lookupApi.getAccommodationTypes(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useAllAccommodations() {
  return useQuery({
    queryKey: lookupKeys.allAccommodations,
    queryFn: () => lookupApi.getAccommodations(),
    staleTime: 1000 * 60 * 30,
  });
}
