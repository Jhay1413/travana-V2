import { useCallback } from "react";
import { useSetDepartureCheck } from "../api/use-departures";
import type { DepartureCheckKey, DepartureRow } from "../types";

/** Tick handler for the lists. Saving, rollback and toasts live in the mutation. */
export function useCheckHandler() {
  const { mutate } = useSetDepartureCheck();
  return useCallback(
    (row: DepartureRow, key: DepartureCheckKey, value: boolean) => {
      mutate({ bookingId: row.bookingId, key, value, clientName: row.clientName });
    },
    [mutate],
  );
}
