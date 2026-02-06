import { useQuery } from "@tanstack/react-query";
import { tourOperatorApi } from "@/api";
import type { TourOperator } from "@/types/tour-operator";

export const tourOperatorKeys = {
  all: ["tourOperators"] as const,
  lists: () => [...tourOperatorKeys.all, "list"] as const,
  list: () => [...tourOperatorKeys.lists()] as const,
};

export function useTourOperators() {
  return useQuery<TourOperator[]>({
    queryKey: tourOperatorKeys.list(),
    queryFn: tourOperatorApi.getAll,
  });
}
