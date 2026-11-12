import { useMemo } from "react";
import { useCurrentUser, useUsers } from "@/hooks/queries";
import { useTickets } from "../api/use-ticket-queries";
import { usePinnedTicketIds } from "../api/use-ticket-pin";
import { agentOptions, deriveQueue } from "../lib/ticket-queue";
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
  // The unfiltered list feeds the Agent options; when an agent is picked the server narrows the rows.
  const { data: allRows, isLoading: loadingAll } = useTickets(prefs.scope);
  const { data: agentRows, isLoading: loadingAgent } = useTickets(prefs.scope, { enabled: !!prefs.agentId, assignedTo: prefs.agentId });
  const rows = prefs.agentId ? agentRows : allRows;
  const isLoading = prefs.agentId ? loadingAgent : loadingAll;
  const { data: roster } = useUsers();
  const agents = useMemo(() => agentOptions(roster ?? []), [roster]);
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

  return { prefs, patch, canViewAll, isLoading, result, agents, now, userId: currentUser?.id };
}
