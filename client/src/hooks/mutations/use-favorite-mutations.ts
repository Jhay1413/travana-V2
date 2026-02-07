import { useMutation, useQueryClient } from "@tanstack/react-query";
import { favoriteApi, ToggleFavoritePayload } from "@/api/endpoints/favorite.api";
import { favoriteKeys } from "@/hooks/queries/use-favorite-queries";

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
