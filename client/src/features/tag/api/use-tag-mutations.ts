import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tagApi } from "./tag.api";
import { tagKeys } from "./use-tag-queries";

/**
 * Rename a tag entity. This is a GLOBAL change — the tag is renamed everywhere
 * it's used (all quotes, clients, bookings), since tags are keyed by a unique
 * name with no per-record copy. Invalidates the tag list so chips refresh.
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => tagApi.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}

/**
 * Delete a tag entity globally. The FK cascade detaches it from every
 * quote/client/booking that referenced it. Invalidates the tag list.
 */
export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tagApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all });
    },
  });
}
