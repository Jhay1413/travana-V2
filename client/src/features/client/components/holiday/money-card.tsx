import { Lock } from "lucide-react";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import type { EnrichedBooking, EnrichedQuote } from "@/features/quote/types";
import { computeQuoteMoney, moneyBarSegments, type MoneyBarSegment } from "@/features/quote/lib/quote-money";
import { useBookingUpsells } from "@/features/booking/api/use-booking-upsell-queries";
import { sumUpsells } from "@/features/booking/types";
import { gbp2, minusGbp2, plusGbp2 } from "@/features/client/lib/money-format";

const SEGMENT_CLASS: Record<MoneyBarSegment["key"], string> = {
  package: "bg-qp-money-pkg",
  commission: "bg-qp-money-comm",
  service: "bg-qp-money-service",
};

function KeyRow({ swatch, label, value, negative }: { swatch: string; label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <i className={cn("size-3 shrink-0 rounded-[3px]", swatch)} aria-hidden />
      {label}
      <b className={cn("ml-auto font-semibold tabular-nums", negative && "text-status-failed-fg")}>{value}</b>
    </div>
  );
}

function UpsellsBlock({ bookingId }: { bookingId: string }) {
  const { data: upsells } = useBookingUpsells(bookingId);
  if (!upsells || upsells.length === 0) return null;
  const { price, commission } = sumUpsells(upsells);
  return (
    <div className="mt-4 border-t border-social-border pt-4" data-testid="money-upsells">
      <h3 className="text-[13px] font-semibold">Upsells</h3>
      <div className="mt-2 flex flex-col gap-2 text-[13px]">
        <div className="flex justify-between gap-2">
          <span className="text-qp-muted">Upsell sales</span>
          <b className="font-semibold tabular-nums">{gbp2(price)}</b>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-qp-muted">Upsell commission</span>
          <b className="font-semibold tabular-nums">{gbp2(commission)}</b>
        </div>
      </div>
      <p className="mt-2 text-xs text-qp-muted">Not counted in the profit above</p>
    </div>
  );
}

/**
 * Body of the "Costings" tab (team only). The figures match the pipeline card:
 * total = sales - discounts + service charge, profit = package + line-item
 * commission. There is deliberately no balance due row.
 *
 * Props:
 * - raw: the loaded quote or booking detail (money fields + service_commission).
 * - mode: "booking" adds the Upsells block underneath.
 */
export function MoneyBody({ raw, mode }: { raw: EnrichedQuote | EnrichedBooking; mode: "quote" | "booking" }) {
  const money = computeQuoteMoney(raw);
  const segments = moneyBarSegments(money);
  const label = `Total package cost ${gbp2(money.total)}: package price ${gbp2(money.packagePrice)}, commission ${gbp2(money.profit)}, discount ${gbp2(money.discount)}, service charge ${gbp2(money.serviceCharge)}`;

  return (
    <div data-testid="holiday-money-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-qp-muted">
          <Lock className="size-[13px]" aria-hidden />
          Only your team sees this
        </span>
        {money.marginPercent !== null && <StatusPill tone="good">{money.marginPercent.toFixed(1)}% margin</StatusPill>}
      </div>

      <div className="my-3 flex h-[14px] gap-0.5 overflow-hidden rounded-[7px] bg-muted" role="img" aria-label={label}>
        {segments.map((s) => (
          <i key={s.key} className={cn("block h-full", SEGMENT_CLASS[s.key])} style={{ width: `${s.widthPercent}%` }} />
        ))}
      </div>

      <div className="flex flex-col gap-2 text-[13px]">
        <KeyRow swatch="bg-qp-money-pkg" label="Package price" value={gbp2(money.packagePrice)} />
        <KeyRow swatch="bg-qp-money-comm" label="Commission" value={gbp2(money.profit)} />
        <KeyRow swatch="bg-status-failed-fg" label="Discount" value={minusGbp2(money.discount)} negative={money.discount > 0} />
        <KeyRow swatch="bg-qp-money-service" label="Service charge" value={plusGbp2(money.serviceCharge)} />
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5 border-t border-social-border pt-3.5 text-[13px]">
        <div className="flex justify-between gap-2.5">
          <span className="text-qp-muted">Total package cost</span>
          <b className="font-semibold tabular-nums">{gbp2(money.total)}</b>
        </div>
        <div className="-mx-2.5 flex justify-between gap-2.5 rounded-[10px] bg-qp-profit-bg px-2.5 py-2 text-[15px] text-qp-profit-fg">
          <b className="font-bold">Your profit</b>
          <b className="font-bold tabular-nums">{gbp2(money.profit)}</b>
        </div>
      </div>

      {mode === "booking" && <UpsellsBlock bookingId={raw.id} />}
    </div>
  );
}
