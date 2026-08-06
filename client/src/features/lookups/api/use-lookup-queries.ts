import { useQuery } from "@tanstack/react-query";
import {
  lookupApi,
  type AccommodationImage,
  type LodgeImage,
  type LookupCruiseLine,
  type LookupCruiseShip,
  type LookupCruiseItinerary,
} from "./lookup.api";

export const lookupKeys = {
  packageTypes: ["lookup", "package-types"] as const,
  countries: ["lookup", "countries"] as const,
  destinations: (countryId?: string) => ["lookup", "destinations", countryId] as const,
  allDestinations: ["lookup", "destinations", "all"] as const,
  destinationSearch: (search: string, countryId?: string) => ["lookup", "destinations", "search", search, countryId] as const,
  byIds: (kind: string, ids: string[]) => ["lookup", kind, "by-ids", ...ids] as const,
  resorts: (destinationId?: string, countryId?: string) => ["lookup", "resorts", destinationId, countryId] as const,
  allResorts: ["lookup", "resorts", "all"] as const,
  accommodations: (resortId?: string) => ["lookup", "accommodations", resortId] as const,
  accommodationSearch: (search: string, resortId?: string, destinationId?: string, countryId?: string) => ["lookup", "accommodations", "search", search, resortId, destinationId, countryId] as const,
  allAccommodations: ["lookup", "accommodations", "all"] as const,
  accommodationTypes: ["lookup", "accommodation-types"] as const,
  boardBasis: ["lookup", "board-basis"] as const,
  parks: ["lookup", "parks"] as const,
  lodges: (parkId?: string) => ["lookup", "lodges", parkId] as const,
  cottages: ["lookup", "cottages"] as const,
  accommodationImages: (accommodationId?: string) => ["lookup", "accommodation-images", accommodationId] as const,
  lodgeImages: (lodgeId?: string) => ["lookup", "lodge-images", lodgeId] as const,
  roomTypes: ["lookup", "room-types"] as const,
  cruiseLines: ["lookup", "cruise-lines"] as const,
  ships: (cruiseLineId?: string) => ["lookup", "ships", cruiseLineId] as const,
  cruiseItineraries: (shipId?: string) => ["lookup", "cruise-itineraries", shipId] as const,
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

export function useResorts(destinationId?: string, countryId?: string) {
  return useQuery({
    queryKey: lookupKeys.resorts(destinationId, countryId),
    queryFn: () => lookupApi.getResorts(destinationId, countryId),
    enabled: !!destinationId || !!countryId,
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

export function useAccommodationSearch(search: string, resortId?: string, destinationId?: string, countryId?: string) {
  return useQuery({
    queryKey: lookupKeys.accommodationSearch(search, resortId, destinationId, countryId),
    queryFn: () => lookupApi.getAccommodations(resortId, destinationId, countryId, search || undefined, search ? 20 : undefined),
    enabled: !!search || !!resortId || !!destinationId || !!countryId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useBoardBasis() {
  return useQuery({
    queryKey: lookupKeys.boardBasis,
    queryFn: () => lookupApi.getBoardBasis(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useParks(parkId?: string) {
  return useQuery({
    queryKey: parkId ? [...lookupKeys.parks, parkId] : lookupKeys.parks,
    queryFn: () => lookupApi.getParks(parkId),
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

export function useDestinationSearch(search: string, countryId?: string) {
  return useQuery({
    queryKey: lookupKeys.destinationSearch(search, countryId),
    queryFn: () => lookupApi.getDestinations(countryId, search || undefined, 10),
    staleTime: 1000 * 60 * 5,
  });
}

// Search-backed selects only hold a page of options, so a value chosen earlier
// — or written by an import — is usually not among them, and a select cannot
// render an option it does not have. These fetch the selected rows by id so the
// caller can merge them into its options and the value always displays.
export function useDestinationsByIds(ids: (string | undefined | null)[]) {
  const clean = Array.from(new Set(ids.filter((i): i is string => !!i)));
  return useQuery({
    queryKey: lookupKeys.byIds("destinations", clean),
    queryFn: () => lookupApi.getDestinations(undefined, undefined, undefined, clean),
    enabled: clean.length > 0,
    staleTime: 1000 * 60 * 30,
  });
}

export function useResortsByIds(ids: (string | undefined | null)[]) {
  const clean = Array.from(new Set(ids.filter((i): i is string => !!i)));
  return useQuery({
    queryKey: lookupKeys.byIds("resorts", clean),
    queryFn: () => lookupApi.getResorts(undefined, undefined, undefined, undefined, clean),
    enabled: clean.length > 0,
    staleTime: 1000 * 60 * 30,
  });
}

export function useAccommodationsByIds(ids: (string | undefined | null)[]) {
  const clean = Array.from(new Set(ids.filter((i): i is string => !!i)));
  return useQuery({
    queryKey: lookupKeys.byIds("accommodations", clean),
    queryFn: () => lookupApi.getAccommodations(undefined, undefined, undefined, undefined, undefined, clean),
    enabled: clean.length > 0,
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

export function useResortSearch(search: string, destinationId?: string, countryId?: string) {
  return useQuery({
    queryKey: ["lookup", "resorts", "search", search, destinationId, countryId] as const,
    queryFn: () => lookupApi.getResorts(destinationId, countryId, search || undefined, 20),
    enabled: !!search || !!destinationId || !!countryId,
    staleTime: 1000 * 60 * 5,
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

export function useRoomTypes() {
  return useQuery({
    queryKey: lookupKeys.roomTypes,
    queryFn: () => lookupApi.getRoomTypes(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useAccommodationImages(accommodationId?: string) {
  return useQuery<AccommodationImage[]>({
    queryKey: lookupKeys.accommodationImages(accommodationId),
    queryFn: () => lookupApi.getAccommodationImages(accommodationId),
    enabled: !!accommodationId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLodgeImages(lodgeId?: string) {
  return useQuery<LodgeImage[]>({
    queryKey: lookupKeys.lodgeImages(lodgeId),
    queryFn: () => lookupApi.getLodgeImages(lodgeId),
    enabled: !!lodgeId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCruiseLines() {
  return useQuery<LookupCruiseLine[]>({
    queryKey: lookupKeys.cruiseLines,
    queryFn: () => lookupApi.getCruiseLines(),
    staleTime: 1000 * 60 * 30,
  });
}

export function useShips(cruiseLineId?: string) {
  return useQuery<LookupCruiseShip[]>({
    queryKey: lookupKeys.ships(cruiseLineId),
    queryFn: () => lookupApi.getShips(cruiseLineId),
    enabled: !!cruiseLineId,
    staleTime: 1000 * 60 * 30,
  });
}

export function useCruiseItineraries(shipId?: string) {
  return useQuery<LookupCruiseItinerary[]>({
    queryKey: lookupKeys.cruiseItineraries(shipId),
    queryFn: () => lookupApi.getCruiseItineraries(shipId),
    enabled: !!shipId,
    staleTime: 1000 * 60 * 30,
  });
}
