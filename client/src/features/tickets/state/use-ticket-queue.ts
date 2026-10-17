import { useMemo } from "react";
import { useCurrentUser } from "@/hooks/queries";
import { useTickets } from "../api/use-ticket-queries";
import { usePinnedTicketIds } from "../api/use-ticket-pin";
import { deriveQueue } from "../lib/ticket-queue";
import { useNow } from "./use-now";
import { useQueuePrefs } from "./use-queue-prefs";

/**
 * The queue as the user has it set up: loads the list for the chosen scope and
 * derives groups, counts and the on-screen order. Used by the queue page and by
 * the ticket page (for previous / next), so both walk the same order.
 */
export function useTicketQueue({ boardAllowed = false }: { boardAllowed?: boolean } = {}) {
  const { prefs, patch, canViewAll } = useQueuePrefs();
  const { data: currentUser } = useCurrentUser();
  const { data: rows, isLoading } = useTickets(prefs.scope);
  const pinned = usePinnedTicketIds();
  const now = useNow();

  const result = useMemo(
    () =>
      deriveQueue({
        rows: rows ?? [],
        scope: prefs.scope,
        userId: currentUser?.id,
        chip: prefs.chip,
        search: prefs.search,
        filters: prefs.filters,
        sort: prefs.sort,
        pinned,
        now,
        includeClosed: boardAllowed && prefs.view === "board",
      }),
    [rows, prefs, currentUser?.id, boardAllowed, pinned, now],
  );

  return { prefs, patch, canViewAll, isLoading, result, now, userId: currentUser?.id };
}
