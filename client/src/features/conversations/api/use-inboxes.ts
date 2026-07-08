import { useQuery } from "@tanstack/react-query";
import { inboxesApi } from "./inboxes.api";

export const inboxesKeys = {
  all: ["inboxes"] as const,
  list: () => [...inboxesKeys.all, "list"] as const,
};

export function useInboxes(enabled = true) {
  return useQuery({
    queryKey: inboxesKeys.list(),
    queryFn: () => inboxesApi.list(),
    enabled,
    staleTime: 5 * 60_000,
  });
}
