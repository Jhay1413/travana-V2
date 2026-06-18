import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // Was Infinity, which meant queries never refetched on remount/navigation
      // (only after an explicit invalidate). 0 = refetch on mount: cached data
      // shows instantly, then refreshes in the background when you revisit.
      staleTime: 0,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
