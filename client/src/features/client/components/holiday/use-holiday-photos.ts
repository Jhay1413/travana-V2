import { useMemo } from "react";
import { useQuoteImages } from "@/features/quote/components/hooks";
import { orderImages } from "@/features/client/lib/hero-mosaic";

/**
 * The deal's photos in viewer order (primary first, only images with a url).
 * Hero's onOpenPhoto(index) indexes this same list, so pass it to PhotoViewer unchanged.
 * Works for quotes and bookings (both detail responses carry `images`).
 */
export function useHolidayPhotos(detail: unknown) {
  const { images } = useQuoteImages(detail);
  return useMemo(() => orderImages(images), [images]);
}
