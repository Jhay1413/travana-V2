import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { Favorite } from "@/api/endpoints/favorite.api";
import { useToast } from "@/hooks/use-toast";

interface PinContext {
  label: string;
  subtitle: string;
}

/**
 * Wraps the dashboard "Pin / Unpin" toggle for a booking: tracks whether the
 * current user has it pinned and exposes a single togglePin() that fires the
 * mutation and toasts the result.
 */
export function useBookingPin(bookingId: string, ctx: PinContext) {
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

  const isFavorited =
    userFavorites?.some((f: Favorite) => f.itemType === "booking" && f.itemId === bookingId) ?? false;

  function togglePin() {
    toggleFavoriteMutation.mutate(
      { itemType: "booking", itemId: bookingId, label: ctx.label, subtitle: ctx.subtitle },
      {
        onSuccess: (data: { favorited?: boolean }) => {
          toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" });
        },
      },
    );
  }

  return { isFavorited, togglePin };
}
