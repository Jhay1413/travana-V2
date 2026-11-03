import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ticketApi } from "../api/ticket.api";
import { ticketKeys } from "../api/use-ticket-queries";
import { summarizeBulk } from "../lib/bulk-summary";
import type { Ticket } from "../types";

/** Per-ticket PATCHes for the list's bulk bar; the server scope decides what each user may change. */
export function useBulkActions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  const run = async (ids: string[], data: Partial<Ticket>, verb: string): Promise<boolean> => {
    setIsRunning(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => ticketApi.update(id, data)));
      // One refresh after the whole batch rather than one per ticket.
      await queryClient.invalidateQueries({ queryKey: ticketKeys.all });
      const summary = summarizeBulk(results, verb);
      toast({ title: summary.title, variant: summary.destructive ? "destructive" : undefined });
      return summary.failed === 0;
    } finally {
      setIsRunning(false);
    }
  };

  return {
    isRunning,
    /** A null user unassigns. */
    assign: (ids: string[], userId: string | null) => run(ids, { assignedTo: userId }, userId ? "reassigned" : "unassigned"),
    setStatus: (ids: string[], status: string) => run(ids, { status }, `set to ${status}`),
  };
}
