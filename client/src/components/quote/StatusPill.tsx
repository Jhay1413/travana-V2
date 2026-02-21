import type { QuoteDisplay } from "./quote-types";

export function StatusPill({ status }: { status: QuoteDisplay["status"] }) {
  const styles =
    status === "accepted"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-900"
      : status === "rejected" || status === "expired"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-900"
        : "border-indigo-500/20 bg-indigo-500/10 text-indigo-900";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`} data-testid={`pill-quote-status-${status}`}>
      {status}
    </span>
  );
}
