import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { channelsKeys } from "@/features/conversations";

/** Refetches channel data when the user returns to this tab (e.g. after connecting in another one). */
export function useRefreshOnReturn() {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void qc.invalidateQueries({ queryKey: channelsKeys.all });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [qc]);
}
