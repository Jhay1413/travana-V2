import { useInfiniteQuery } from "@tanstack/react-query";
import { searchApi } from "@/api";

export const searchKeys = {
  all: ["global-search"] as const,
  query: (q: string) => [...searchKeys.all, q] as const,
};

export function useGlobalSearch(q: string) {
  return useInfiniteQuery({
    queryKey: searchKeys.query(q),
    queryFn: ({ pageParam = 0 }) => searchApi.globalSearch(q, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}
