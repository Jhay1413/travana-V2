/**
 * Custom Hooks for Quote Page
 * Data fetching and state management hooks.
 */

import { useMemo } from "react";
import { useQuote, useBooking, useClient, useNeonClient } from "@/hooks/queries";
import { transformQuoteData } from "../utils/transformers";
import type { QuoteDisplay } from "../utils/types";

/**
 * Hook to fetch and transform quote or booking data
 */
export function useQuoteData(quoteId: string, clientId: string, isBooking: boolean = false) {
  // Fetch quote or booking data
  const quoteQuery = useQuote(isBooking ? "" : quoteId);
  const bookingQuery = useBooking(isBooking ? quoteId : "");
  const { data: rawData, isLoading, error } = isBooking ? bookingQuery : quoteQuery;

  //Fetch client data
  const clientQuery = useClient(isBooking ? "" : clientId);
  const neonClientQuery = useNeonClient(isBooking ? clientId : "");
  const clientData = isBooking
    ? neonClientQuery.data
      ? {
          name: `${neonClientQuery.data.firstName || ""} ${neonClientQuery.data.surename || ""}`.trim(),
        }
      : undefined
    : clientQuery.data;

  // Transform data
  const quote = useMemo<QuoteDisplay | null>(() => {
    if (!rawData) return null;
    return transformQuoteData(rawData);
  }, [rawData]);

  // Get images
  const images = useMemo(() => {
    const imgs = rawData?.images || [];
    return imgs.map((img: { id: string; image_url: string | null; isPrimary: boolean | null; owner_type?: string | null }) => ({
      id: img.id,
      url: img.image_url || "",
      isPrimary: img.isPrimary,
      ownerType: img.owner_type || "quote",
    }));
  }, [rawData]);

  const primaryImage = useMemo(
    () => images.find((img: { isPrimary: boolean | null }) => img.isPrimary) || images[0],
    [images]
  );

  const galleryImages = useMemo(
    () => images.filter((img: { id: string }) => img.id !== primaryImage?.id),
    [images, primaryImage]
  );

  return {
    quote,
    rawData,
    clientData,
    isLoading,
    error,
    images,
    primaryImage,
    galleryImages,
  };
}
