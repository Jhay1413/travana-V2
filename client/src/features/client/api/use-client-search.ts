import { useQuery } from "@tanstack/react-query";
import { neonClientApi } from "./neon-client.api";

// Lightweight client lookup for pickers. Disabled until there is a query.
export function useClientSearch(search: string, limit = 6) {
  const term = search.trim();
  return useQuery({
    queryKey: ["neon-clients", "search", term, limit],
    queryFn: () => neonClientApi.getAll({ page: 1, limit, search: term }),
    enabled: term.length > 0,
    staleTime: 30_000,
  });
}
