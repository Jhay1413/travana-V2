import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { requestErrorMessage } from "@/lib/request-error";
import { applyCheck } from "../lib/checks";
import type { DepartureCheckKey, DepartureListParams, DepartureRow, DepartureSummary } from "../types";
import { departuresApi } from "./departures.api";

export const departuresKeys = {
  all: ["departures"] as const,
  lists: () => [...departuresKeys.all, "list"] as const,
  list: (params: DepartureListParams) => [...departuresKeys.lists(), { from: params.from ?? null, to: params.to ?? null }] as const,
  summaries: () => [...departuresKeys.all, "summary"] as const,
  summary: (days: number) => [...departuresKeys.summaries(), days] as const,
  setCheck: () => [...departuresKeys.all, "setCheck"] as const,
};

export function useDepartures(params: DepartureListParams = {}) {
  return useQuery<DepartureRow[]>({
    queryKey: departuresKeys.list(params),
    queryFn: () => departuresApi.list(params),
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useDepartureSummary(days: number) {
  return useQuery<DepartureSummary>({
    queryKey: departuresKeys.summary(days),
    queryFn: () => departuresApi.summary(days),
    retry: false,
  });
}

export interface SetCheckVars {
  bookingId: string;
  key: DepartureCheckKey;
  value: boolean;
  /** For the "marked completed" toast. */
  clientName: string;
}

interface Previous {
  bookingId: string;
  row: DepartureRow | undefined;
}

function replaceRow(rows: DepartureRow[] | undefined, bookingId: string, next: (r: DepartureRow) => DepartureRow) {
  return rows?.map((r) => (r.bookingId === bookingId ? next(r) : r));
}

/** One tick: optimistic across every cached list, rolled back for that row only if the server refuses. */
export function useSetDepartureCheck() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const { toast } = useToast();
  const mutationKey = departuresKeys.setCheck();

  return useMutation<DepartureRow, unknown, SetCheckVars, Previous>({
    mutationKey,
    mutationFn: ({ bookingId, key, value }) => departuresApi.setCheck(bookingId, key, value),
    onMutate: async ({ bookingId, key, value }) => {
      await queryClient.cancelQueries({ queryKey: departuresKeys.lists() });
      const actor = { id: me?.id ?? null, name: me?.name ?? null };
      const now = new Date();
      let row: DepartureRow | undefined;
      for (const [, rows] of queryClient.getQueriesData<DepartureRow[]>({ queryKey: departuresKeys.lists() })) {
        row = rows?.find((r) => r.bookingId === bookingId);
        if (row) break;
      }
      queryClient.setQueriesData<DepartureRow[]>({ queryKey: departuresKeys.lists() }, (rows) =>
        replaceRow(rows, bookingId, (r) => applyCheck(r, key, value, actor, now)),
      );
      return { bookingId, row };
    },
    onError: (err, _vars, previous) => {
      if (previous?.row) {
        const { checks, lastChange } = previous.row;
        queryClient.setQueriesData<DepartureRow[]>({ queryKey: departuresKeys.lists() }, (rows) =>
          replaceRow(rows, previous.bookingId, (r) => ({ ...r, checks, lastChange })),
        );
      }
      toast({ title: "Couldn't save that tick", description: requestErrorMessage(err, "Please try again."), variant: "destructive" });
    },
    onSuccess: (row, vars) => {
      queryClient.setQueriesData<DepartureRow[]>({ queryKey: departuresKeys.lists() }, (rows) => replaceRow(rows, row.bookingId, () => row));
      if (vars.key === "completed" && vars.value) toast({ title: `${vars.clientName} marked completed` });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: departuresKeys.summaries() });
      // Refetch the lists only when the last overlapping tick has finished, so a slow response can't overwrite a newer tick.
      if (queryClient.isMutating({ mutationKey }) === 1) void queryClient.invalidateQueries({ queryKey: departuresKeys.lists() });
    },
  });
}
