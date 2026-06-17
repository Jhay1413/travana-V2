import { useMemo } from "react";
import type { DealImage } from "@/features/quote/types";

export interface QuoteImage {
  id: string;
  url: string;
  isPrimary: boolean | null;
  ownerType: string;
}

export function useQuoteImages(quoteData: any) {
  const images = useMemo<QuoteImage[]>(() => {
    const imgs: DealImage[] = quoteData?.images || [];
    return imgs.map((img: DealImage) => ({
      id: img.id,
      url: img.image_url || "",
      isPrimary: img.isPrimary,
      ownerType: img.owner_type || "quote",
    }));
  }, [quoteData]);

  const primaryImage = useMemo(() => images.find((img) => img.isPrimary) || images[0], [images]);

  const galleryImages = useMemo(
    () => images.filter((img) => img.id !== primaryImage?.id),
    [images, primaryImage],
  );

  const quoteImageUrls = useMemo(
    () =>
      ((quoteData?.images ?? []) as DealImage[])
        .map((img) => img.image_url)
        .filter((url): url is string => Boolean(url)),
    [quoteData?.images],
  );

  return { images, primaryImage, galleryImages, quoteImageUrls };
}
