import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supplierScraperPicksApi } from "./supplier-scraper-picks.api";
import { supplierScraperKeys } from "./use-supplier-scrapers";

// Applying picks can add or replace rules in the stored spec (and may flip
// specNeedsReview), so the scraper list — which renders the "Needs
// review"/"Approved" pill — needs to refetch after a successful submit.
export function useSupplierScraperPicks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => supplierScraperPicksApi.submit(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: supplierScraperKeys.all }),
  });
}
