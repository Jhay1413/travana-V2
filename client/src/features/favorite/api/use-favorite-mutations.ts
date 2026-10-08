import { useMutation, useQueryClient } from "@tanstack/react-query";
import { favoriteApi, type Favorite, type ToggleFavoritePayload } from "./favorite.api";
import { favoriteKeys } from "./use-favorite-queries";
import { transactionKeys } from "@/features/transaction/api/use-transaction-queries";

// Item types that can be a pipeline card's pin target. A toggle on one of these
// changes server-side column ordering (pinned deals lead), so the board's column
// queries are refetched afterwards.
const PIPELINE_PIN_TYPES: ReadonlySet<string> = new Set(["enquiry", "quote", "booking"]);

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ToggleFavoritePayload) => favoriteApi.toggle(data),
    // Optimistic: flip the pin in the cached favourites list immediately so every
    // pin indicator (cards, list view, detail pages) responds without waiting
    // for the round trip.
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.all, exact: true });
      const previous = queryClient.getQueryData<Favorite[]>(favoriteKeys.all);
      if (previous) {
        const exists = previous.some((f) => f.itemType === data.itemType && f.itemId === data.itemId);
        const next: Favorite[] = exists
          ? previous.filter((f) => !(f.itemType === data.itemType && f.itemId === data.itemId))
          : [
              ...previous,
              {
                id: `optimistic-${data.itemType}-${data.itemId}`,
                userId: "",
                itemType: data.itemType,
                itemId: data.itemId,
                label: data.label,
                subtitle: data.subtitle ?? null,
                displayOrder: previous.length,
                createdAt: new Date().toISOString(),
              },
            ];
        queryClient.setQueryData<Favorite[]>(favoriteKeys.all, next);
      }
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) queryClient.setQueryData<Favorite[]>(favoriteKeys.all, context.previous);
    },
    onSettled: (_result, _err, data) => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      if (PIPELINE_PIN_TYPES.has(data.itemType)) {
        // Prefix match on ["transactions","pipeline",...]: every column re-sorts
        // in the background (existing cards stay on screen until fresh data lands).
        queryClient.invalidateQueries({ queryKey: [...transactionKeys.all, "pipeline"] });
      }
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => favoriteApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      queryClient.invalidateQueries({ queryKey: [...transactionKeys.all, "pipeline"] });
    },
  });
}
