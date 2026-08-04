import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supplierScraperApi } from "./supplier-scraper.api";
import type { UpsertSupplierScraperInput } from "../types";

export const supplierScraperKeys = {
  all: ["supplier-scrapers"] as const,
};

export function useSupplierScrapers() {
  return useQuery({
    queryKey: supplierScraperKeys.all,
    queryFn: supplierScraperApi.list,
  });
}

export function useCreateSupplierScraper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertSupplierScraperInput) => supplierScraperApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierScraperKeys.all }),
  });
}

export function useUpdateSupplierScraper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpsertSupplierScraperInput }) =>
      supplierScraperApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierScraperKeys.all }),
  });
}

export function useDeleteSupplierScraper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supplierScraperApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierScraperKeys.all }),
  });
}
