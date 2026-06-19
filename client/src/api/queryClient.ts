import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // Data stays "fresh" for 30s: navigating between pages within that window
      // serves cache instantly with NO refetch (no loading flash / double render).
      // After 30s a revisit shows cache immediately, then refreshes in the
      // background. Mutations still invalidate their queries explicitly, so
      // user-initiated changes reflect right away regardless of this value.
      staleTime: 30_000,
      gcTime: 1000 * 60 * 10,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
