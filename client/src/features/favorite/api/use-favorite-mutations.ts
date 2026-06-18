import { useMutation, useQueryClient } from "@tanstack/react-query";
import { favoriteApi, type ToggleFavoritePayload } from "./favorite.api";
import { favoriteKeys } from "./use-favorite-queries";

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ToggleFavoritePayload) => favoriteApi.toggle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => favoriteApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
    },
  });
}
