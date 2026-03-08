import { useQuery } from "@tanstack/react-query";
import { searchApi } from "@/api";

export const searchKeys = {
  all: ["global-search"] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: searchKeys.query(q),
    queryFn: () => searchApi.globalSearch(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}
