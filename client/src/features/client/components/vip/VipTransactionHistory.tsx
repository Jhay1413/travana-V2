import { ArrowDownToLine, ArrowUpFromLine, Briefcase, Receipt } from "lucide-react";
import type { VipWalletLedgerEntry } from "@/api/endpoints/referral.api";
import { fmt, formatVipDate } from "./vip-utils";

interface VipTransactionHistoryProps {
  ledger: VipWalletLedgerEntry[];
  clientId: string;
  navigate: (to: string) => void;
}

export function VipTransactionHistory({ ledger, clientId, navigate }: VipTransactionHistoryProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="vip-transaction-history">
      <div className="mb-3 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-semibold text-black/80">Transaction History</span>
        {ledger.length > 0 && (
          <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
            {ledger.length}
          </span>
        )}
      </div>

      {ledger.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-6 text-center">
          <Briefcase className="mx-auto mb-2 h-8 w-8 text-black/15" />
          <p className="text-sm text-black/45">No wallet activity yet</p>
          <p className="mt-0.5 text-xs text-black/35">
            Credits and withdrawals will appear here once commissions are released
          </p>
        </div>
      ) : (
        <div className="divide-y divide-black/[0.06]">
          {ledger.map((entry) => {
            const isCredit = entry.type === "credit";
            const isPending = entry.status === "pending";
            const isBookingCredit = entry.source === "booking_credit";
            const label = isCredit
              ? "Commission credited"
              : isBookingCredit
                ? "Booking credit applied"
                : isPending
                  ? "Withdrawal requested"
                  : "Withdrawal processed";
            const subtitle = isCredit
              ? `From ${entry.referral_referred_name ?? "referred client"}`
              : isBookingCredit
                ? entry.booking_hays_ref
                  ? `Applied to booking ${entry.booking_hays_ref}`
                  : "Applied to booking"
                : "Bank transfer";
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                data-testid={`vip-ledger-row-${entry.id}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      isCredit ? "bg-emerald-100" : "bg-orange-100"
                    }`}
                  >
                    {isCredit ? (
                      <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-orange-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-black/80">{label}</span>
                      {isPending && (
                        <span className="text-[10px] font-semibold border rounded-full px-1.5 py-0.5 text-amber-600 bg-amber-50 border-amber-200">
                          pending
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-black/40">
                      {subtitle && <span className="mr-2">{subtitle}</span>}
                      {formatVipDate(entry.processed_at ?? entry.created_at)}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right flex flex-col items-end gap-1">
                  <span
                    className={`text-sm font-bold leading-none whitespace-nowrap ${
                      isCredit ? "text-emerald-600" : "text-orange-600"
                    }`}
                  >
                    {isCredit ? "+" : "−"}
                    {fmt(parseFloat(entry.amount))}
                  </span>
                  {isBookingCredit && entry.booking_id && (
                    <button
                      type="button"
                      onClick={() => navigate(`/clients/${clientId}/bookings/${entry.booking_id}`)}
                      className="inline-flex items-center rounded-md border border-blue-200 px-2 py-0.5 text-[10px] font-semibold leading-none text-blue-700 hover:bg-blue-50"
                    >
                      View booking
                    </button>
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
