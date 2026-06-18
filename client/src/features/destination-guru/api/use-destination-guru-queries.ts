import { useQuery } from "@tanstack/react-query";
import { destinationGuruApi } from "./destination-guru.api";

export const destinationGuruKeys = {
  all: ["destination-guru"] as const,
  detail: (id: string) => ["destination-guru", id] as const,
  search: (destination: string) => ["destination-guru", "search", destination] as const,
};

export function useDestinationGuruList() {
  return useQuery({
    queryKey: destinationGuruKeys.all,
    queryFn: destinationGuruApi.getAll,
  });
}

export function useDestinationGuruById(id: string) {
  return useQuery({
    queryKey: destinationGuruKeys.detail(id),
    queryFn: () => destinationGuruApi.getById(id),
    enabled: !!id,
  });
}

export function useDestinationGuruSearch(destination: string) {
  return useQuery({
    queryKey: destinationGuruKeys.search(destination),
    queryFn: () => destinationGuruApi.searchByDestination(destination),
    enabled: !!destination,
    retry: false,
  });
}
