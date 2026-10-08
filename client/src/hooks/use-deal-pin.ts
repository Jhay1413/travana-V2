import { useMemo } from "react";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import { useToast } from "@/hooks/use-toast";

export type PinnableDealType = "enquiry" | "quote" | "booking";

interface PinContext {
  label: string;
  subtitle: string;
}

/**
 * List-level pin toggle for deal cards. The per-entity hooks (useQuotePin,
 * useBookingPin, useEnquiryPin) bind to ONE id, which can't be called per row
 * in a list — this one fetches favourites once and takes the target per call.
 */
export function useDealPin() {
  const { toast } = useToast();
  const { data: favorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

  const pinnedKeys = useMemo(
    () =>
      new Set(
        (favorites ?? [])
          .filter((f) => f.itemType === "enquiry" || f.itemType === "quote" || f.itemType === "booking")
          .map((f) => `${f.itemType}:${f.itemId}`),
      ),
    [favorites],
  );

  function togglePin(itemType: PinnableDealType, itemId: string, ctx: PinContext) {
    toggleFavoriteMutation.mutate(
      { itemType, itemId, label: ctx.label, subtitle: ctx.subtitle },
      {
        onSuccess: (data: { favorited?: boolean }) => {
          toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" });
        },
      },
    );
  }

  return { pinnedKeys, togglePin, isLoaded: favorites !== undefined };
}
