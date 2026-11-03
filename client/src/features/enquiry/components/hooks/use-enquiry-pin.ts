import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import { useToast } from "@/hooks/use-toast";

interface PinContext {
  label: string;
  subtitle: string;
}

/**
 * Wraps the dashboard "Pin / Unpin" toggle for an enquiry: tracks whether the
 * current user has it pinned and exposes a single togglePin() that fires the
 * mutation with the appropriate label/subtitle and toasts the result.
 */
export function useEnquiryPin(enquiryId: string, ctx: PinContext) {
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

  const isFavorited =
    userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === enquiryId) ?? false;

  function togglePin() {
    toggleFavoriteMutation.mutate(
      { itemType: "enquiry", itemId: enquiryId, label: ctx.label, subtitle: ctx.subtitle },
      {
        onSuccess: (data: { favorited?: boolean }) => {
          toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" });
        },
      },
    );
  }

  return { isFavorited, togglePin };
}
