import { useEffect, useState } from "react";
import { londonDayKey } from "@/lib/london-day";

/** Today's London day key, kept current while the page stays open: re-checked on a timer, on focus and when the tab becomes visible. */
export function useLondonDay(intervalMs = 30_000): string {
  const [day, setDay] = useState(() => londonDayKey(new Date()));
  useEffect(() => {
    const check = () => setDay(londonDayKey(new Date()));
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const id = window.setInterval(check, intervalMs);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return day;
}
