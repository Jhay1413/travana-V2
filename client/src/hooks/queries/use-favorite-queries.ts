import { useQuery } from "@tanstack/react-query";
import { favoriteApi } from "@/api/endpoints/favorite.api";

export const favoriteKeys = {
  all: ["favorites"] as const,
  check: (itemType: string, itemId: string) => ["favorites", "check", itemType, itemId] as const,
};

export function useFavorites() {
  return useQuery({
    queryKey: favoriteKeys.all,
    queryFn: () => favoriteApi.getAll(),
  });
}

export function useIsFavorited(itemType: string, itemId: string) {
  return useQuery({
    queryKey: favoriteKeys.check(itemType, itemId),
    queryFn: () => favoriteApi.check(itemType, itemId),
    enabled: !!itemType && !!itemId,
  });
}
