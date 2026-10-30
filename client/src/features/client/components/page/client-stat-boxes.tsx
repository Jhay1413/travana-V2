import { CirclePoundSterling } from "lucide-react";
import { formatStatDate, type ClientStats } from "@/features/client/lib/client-stats";
import { currency } from "@/features/client/components/client-types";

function caption(prefix: string, date: Date | null): string {
  const formatted = formatStatDate(date);
  return formatted ? `${prefix} ${formatted}` : "";
}

function StatBox({ label, value, caption: sub, testId }: { label: string; value: string; caption: string; testId: string }) {
  return (
    <div className="relative min-w-0 rounded-[14px] border border-social-border px-5 py-[18px]" data-testid={testId}>
      <span
        className="absolute -right-2 -top-2 grid h-[26px] w-[26px] place-items-center rounded-full bg-[#10B981] text-white ring-2 ring-card"
        aria-hidden
      >
        <CirclePoundSterling className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <div className="text-[13px] font-semibold">{label}</div>
      <div className="mt-1 whitespace-nowrap text-[34px] font-semibold leading-tight">{value}</div>
      <div className="mt-0.5 min-h-4 text-xs text-social-muted">
        {sub}
      </div>
    </div>
  );
}

/** Enquiries / Quotes / Bookings (with the latest date) and Total profit (with Av. PPB). */
export function ClientStatBoxes({ stats }: { stats: ClientStats }) {
  return (
    <section className="rounded-2xl border border-social-border bg-card p-6" data-testid="client-index-stats">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox label="Enquiries" value={String(stats.enquiries)} caption={caption("Last enq.", stats.lastEnquiry)} testId="client-index-stat-enquiries" />
        <StatBox label="Quotes" value={String(stats.quotes)} caption={caption("Last quote", stats.lastQuote)} testId="client-index-stat-quotes" />
        <StatBox label="Bookings" value={String(stats.bookings)} caption={caption("Last booked", stats.lastBooking)} testId="client-index-stat-bookings" />
        <StatBox
          label="Total profit"
          value={currency.format(stats.profit)}
          caption={stats.avgPpb > 0 ? `Av. PPB ${currency.format(stats.avgPpb)}` : ""}
          testId="client-index-stat-total-profit"
        />
      </div>
    </section>
  );
}
