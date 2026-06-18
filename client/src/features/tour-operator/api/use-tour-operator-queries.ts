import { useQuery } from "@tanstack/react-query";
import { tourOperatorApi } from "./tour-operator.api";
import type { TourOperator } from "../types";

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
