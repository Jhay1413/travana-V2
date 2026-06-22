/**
 * StatusPill Component
 * Badge component showing quote/booking status with appropriate styling
 */

import type { QuoteDisplay } from "./utils/types";

interface StatusPillProps {
  status: QuoteDisplay["status"];
}

function getStyles(status: string): string {
  if (status === "in_play")
    return "border-amber-500/20 bg-amber-500/10 text-amber-900";
  if (status === "lost" || status === "rejected")
    return "border-rose-500/20 bg-rose-500/10 text-rose-900";
  if (status === "archived")
    return "border-slate-400/20 bg-slate-100/60 text-slate-700";
  // "quoted", "accepted", and any unknown value fall through to indigo (default)
  return "border-indigo-500/20 bg-indigo-500/10 text-indigo-900";
}

export function StatusPill({ status }: StatusPillProps) {
  const styles = getStyles(status);
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (m) => m.toLowerCase());

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`}
      data-testid={`pill-quote-status-${status}`}
    >
      {label}
    </span>
  );
}
