import { CircleDollarSign, Clock, Users, Wallet } from "lucide-react";
import { fmt } from "./vip-utils";

interface VipStats {
  total?: number;
  pendingPayout?: number;
  pendingCount?: number;
  availableBalance?: number;
  inWalletCount?: number;
  overallPayout?: number;
  paidCount?: number;
}

export function VipStatsGrid({ stats }: { stats: VipStats | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="vip-stats-grid">
      <div
        className="flex flex-col gap-1 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3"
        data-testid="vip-stat-total"
      >
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-purple-600" />
          <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Referred</span>
        </div>
        <div className="text-2xl font-bold text-black/85">{stats?.total ?? 0}</div>
        <div className="text-[10px] text-black/40">Total clients referred</div>
      </div>
      <div
        className="flex flex-col gap-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3"
        data-testid="vip-stat-pending"
      >
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Pending</span>
        </div>
        <div className="text-xl font-bold text-black/85">{fmt(stats?.pendingPayout ?? 0)}</div>
        <div className="text-[10px] text-black/40">{stats?.pendingCount ?? 0} awaiting payout</div>
      </div>
      <div
        className="flex flex-col gap-1 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3"
        data-testid="vip-stat-wallet"
      >
        <div className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Available</span>
        </div>
        <div className="text-xl font-bold text-black/85">{fmt(stats?.availableBalance ?? 0)}</div>
        <div className="text-[10px] text-black/40">{stats?.inWalletCount ?? 0} ready to withdraw</div>
      </div>
      <div
        className="flex flex-col gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3"
        data-testid="vip-stat-overall"
      >
        <div className="flex items-center gap-1.5">
          <CircleDollarSign className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">All-time Earned</span>
        </div>
        <div className="text-xl font-bold text-black/85">{fmt(stats?.overallPayout ?? 0)}</div>
        <div className="text-[10px] text-black/40">{stats?.paidCount ?? 0} paid out</div>
      </div>
    </div>
  );
}
