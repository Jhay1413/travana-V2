import { useQuery } from "@tanstack/react-query";
import { tagApi } from "@/api";

export const tagKeys = {
  all: ["tags"] as const,
  lists: () => [...tagKeys.all, "list"] as const,
  search: (query: string) => [...tagKeys.all, "search", query] as const,
};

export function useTags() {
  return useQuery({
    queryKey: tagKeys.lists(),
    queryFn: () => tagApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSearchTags(query: string) {
  return useQuery({
    queryKey: tagKeys.search(query),
    queryFn: () => tagApi.search(query),
    enabled: !!query,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
