import { useState } from "react";
import { useDestinationGuruSearch } from "@/features/destination-guru/api/use-destination-guru-queries";
import { useGenerateDestinationGuru } from "@/features/destination-guru/api/use-destination-guru-mutations";

/**
 * Owns the Destination Guru sheet state and exposes the queries/mutations
 * the QuotePage uses to render and refresh the panel.
 */
export function useQuoteGuru(quote: any, quoteData: any) {
  const [showGuruSheet, setShowGuruSheet] = useState(false);

  const isHotTub =
    (quoteData as any)?.quote_type === "hot_tub_break" ||
    quote?.packageType?.toLowerCase().includes("hot tub");

  const guruDestination = isHotTub
    ? [quote?.lodge?.parkName, quote?.lodge?.parkLocation].filter(Boolean).join(", ")
    : quote?.destinationName || quote?.destination || "";

  const { data: guruRecord } = useDestinationGuruSearch(guruDestination);
  const generateGuruMutation = useGenerateDestinationGuru();

  return {
    showGuruSheet,
    setShowGuruSheet,
    isHotTub,
    guruDestination,
    guruRecord,
    generateGuruMutation,
  };
}
