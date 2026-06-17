import { CircleDollarSign, TrendingDown, Users, Wallet } from "lucide-react";
import { useVipOverview } from "@/features/referral/api/use-referral-queries";
import { currency } from "../client-types";

export function ReferralStatsSection({ clientId }: { clientId: string }) {
  const { data, isLoading } = useVipOverview(clientId);
  const stats = data?.stats;

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 animate-pulse"
        data-testid="referral-stats-loading"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl border border-black/10 bg-black/[0.03]" />
        ))}
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const pending = stats?.pendingPayout ?? 0;
  const wallet = stats?.availableBalance ?? 0;
  const overall = stats?.overallPayout ?? 0;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3" data-testid="referral-stats-section">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-purple-600" />
        <div className="text-sm font-semibold text-black">Referral Summary</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
          className="flex flex-col gap-0.5 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-2.5"
          data-testid="stat-total-referred"
        >
          <div className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-purple-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Referred</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{total}</div>
          <div className="text-[9px] text-black/40">Total clients</div>
        </div>
        <div
          className="flex flex-col gap-0.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5"
          data-testid="stat-pending-commission"
        >
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-amber-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Pending</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{currency.format(pending)}</div>
          <div className="text-[9px] text-black/40">Awaiting approval</div>
        </div>
        <div
          className="flex flex-col gap-0.5 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-2.5"
          data-testid="stat-wallet-balance"
        >
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3 w-3 text-blue-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Wallet</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{currency.format(wallet)}</div>
          <div className="text-[9px] text-black/40">Ready to withdraw</div>
        </div>
        <div
          className="flex flex-col gap-0.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5"
          data-testid="stat-overall-commission"
        >
          <div className="flex items-center gap-1.5">
            <CircleDollarSign className="h-3 w-3 text-emerald-600" />
            <span className="text-[9px] font-semibold text-black/50 uppercase tracking-wide">Overall</span>
          </div>
          <div className="text-lg font-bold text-black/85 leading-tight">{currency.format(overall)}</div>
          <div className="text-[9px] text-black/40">All-time commission</div>
        </div>
      </div>
    </div>
  );
}
