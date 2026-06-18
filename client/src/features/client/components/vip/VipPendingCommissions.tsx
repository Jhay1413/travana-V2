import {
  AlertCircle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Hourglass,
  TrendingUp,
} from "lucide-react";
import type { VipTransactionRow } from "@/features/referral/api/referral.api";
import { fmt, formatVipDate } from "./vip-utils";

interface VipPendingCommissionsProps {
  rows: VipTransactionRow[];
}

export function VipPendingCommissions({ rows }: VipPendingCommissionsProps) {
  const pending = rows.filter((r) => r.referralStatus === "PENDING");

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="vip-pending-commissions">
      <div className="mb-3 flex items-center gap-2">
        <Hourglass className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-semibold text-black/80">Pending Commissions</span>
        {pending.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
            {pending.length}
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-6 text-center">
          <TrendingUp className="mx-auto mb-2 h-8 w-8 text-black/15" />
          <p className="text-sm text-black/45">No pending commissions</p>
          <p className="mt-0.5 text-xs text-black/35">
            Commissions will appear here once a referred client's booking is confirmed
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.06]">
          {pending.map((row) => {
            const isPending = row.referralStatus === "PENDING";
            const isDue = row.isDue;
            const payout = parseFloat(row.payoutAmount ?? row.commission ?? "0");
            const referredName =
              [row.referredClientFirstName, row.referredClientSurname].filter(Boolean).join(" ") ||
              row.referredName ||
              "Client";
            const triggerDate = row.payoutTriggerDate;
            const travelDate = row.bookingTravelDate ?? row.travelDate;

            return (
              <div
                key={row.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                data-testid={`vip-pending-row-${row.id}`}
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isDue ? "bg-emerald-100" : "bg-amber-50"
                  }`}
                >
                  {isDue ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-black/85">{referredName}</span>
                    {isPending && !isDue && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                        Pending
                      </span>
                    )}
                    {isPending && isDue && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                        Due — Ready to release
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-black/45">
                    {row.bookingTitle && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {row.bookingTitle}
                      </span>
                    )}
                    {travelDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Travel: {formatVipDate(travelDate)}
                      </span>
                    )}
                    {triggerDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {isDue ? "Payout trigger date passed" : `Releases: ${formatVipDate(triggerDate)}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-sm font-bold text-black/85">{fmt(payout)}</span>
                  {row.bookingHaysRef && (
                    <div className="mt-0.5 text-[10px] text-black/35">Ref: {row.bookingHaysRef}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
