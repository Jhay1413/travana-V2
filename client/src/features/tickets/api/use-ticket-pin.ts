import { useMemo } from "react";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import { useToast } from "@/hooks/use-toast";

// A pinned ticket is just a favorite with this itemType — the app already has
// a generic per-user pin mechanism (bookings, quotes, clients all go through
// it), so tickets reuse it rather than growing a bespoke pin column/endpoint.
const TICKET_ITEM_TYPE = "ticket";

interface TicketPinContext {
  label: string;
  subtitle?: string;
}

/**
 * The current user's pinned tickets as ticket id -> time pinned (ms). Lists use
 * `.has(id)` to flag a row and pass the whole map to sortPinnedFirst(), which
 * orders the pinned group most-recently-pinned first.
 */
export function usePinnedTicketIds(): Map<string, number> {
  const { data: userFavorites } = useFavorites();
  return useMemo(() => {
    const pinnedAt = new Map<string, number>();
    for (const fav of userFavorites ?? []) {
      if (fav.itemType !== TICKET_ITEM_TYPE) continue;
      const at = new Date(fav.createdAt).getTime();
      pinnedAt.set(fav.itemId, Number.isNaN(at) ? 0 : at);
    }
    return pinnedAt;
  }, [userFavorites]);
}

/**
 * Wraps the ticket "Pin / Unpin" toggle: tracks whether the current user has
 * this ticket pinned and exposes a single togglePin() that fires the mutation
 * and toasts the result.
 *
 * The optimistic flip (and its rollback) lives entirely in useToggleFavorite,
 * so every list deriving from usePinnedTicketIds() re-sorts the instant the user
 * clicks. Do NOT flip the favorites cache here as well: two flips cancel out.
 */
export function useTicketPin(ticketId: string, ctx: TicketPinContext) {
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();

  const isPinned = !!userFavorites?.some((f: Favorite) => f.itemType === TICKET_ITEM_TYPE && f.itemId === ticketId);

  function togglePin() {
    toggleFavoriteMutation.mutate(
      { itemType: TICKET_ITEM_TYPE, itemId: ticketId, label: ctx.label, subtitle: ctx.subtitle },
      {
        onSuccess: (data: { favorited?: boolean }) => {
          toast({ title: data?.favorited ? "Ticket pinned" : "Ticket unpinned" });
        },
        onError: () => {
          toast({ title: "Failed to update pin", variant: "destructive" });
        },
      },
    );
  }

  return { isPinned, togglePin };
}
