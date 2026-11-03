import { useEffect, useState } from "react";

/**
 * A Date that updates every `intervalMs` (default 60s). Lets time-relative
 * derivations (e.g. getQuoteExpiryInfo's "is this quote expired now") re-run
 * on a page that's left open across the expiry instant, without waiting for
 * a full refetch.
 */
export function useLiveNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
