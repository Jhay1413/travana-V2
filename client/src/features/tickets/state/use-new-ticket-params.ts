import { useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { TICKET_STATUSES, type TicketStatusValue } from "../types";

export interface NewTicketParams {
  open: boolean;
  clientId?: string;
  status?: TicketStatusValue;
}

/** Reads `?new=1&client=<id>&status=<status>` on /tickets and clears them when the dialog closes. */
export function useNewTicketParams() {
  const search = useSearch();
  const [, navigate] = useLocation();

  const params = useMemo<NewTicketParams>(() => {
    const q = new URLSearchParams(search);
    const status = q.get("status");
    return {
      open: q.get("new") === "1",
      clientId: q.get("client") || undefined,
      status: (TICKET_STATUSES as readonly string[]).includes(status ?? "") ? (status as TicketStatusValue) : undefined,
    };
  }, [search]);

  const openNew = useCallback(
    (opts?: { clientId?: string; status?: TicketStatusValue }) => {
      const q = new URLSearchParams({ new: "1" });
      if (opts?.clientId) q.set("client", opts.clientId);
      if (opts?.status) q.set("status", opts.status);
      navigate(`/tickets?${q.toString()}`);
    },
    [navigate],
  );

  const close = useCallback(() => navigate("/tickets", { replace: true }), [navigate]);

  return { params, openNew, close };
}
