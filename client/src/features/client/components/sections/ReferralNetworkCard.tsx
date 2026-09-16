import { BanknoteArrowDown, CirclePoundSterling, CreditCard, Megaphone, Users, Wallet, type LucideIcon } from "lucide-react";
import { useVipOverview } from "@/features/referral/api/use-referral-queries";
import { cn } from "@/lib/utils";
import { currency } from "../client-types";

function StatTile({
  icon: Icon,
  label,
  value,
  caption,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  testId: string;
}) {
  return (
    <div className="min-w-0 rounded-sm border border-black/10 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-white/[0.04]" data-testid={testId}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-4 w-4 text-[#00a6f4]" strokeWidth={1.75} />
        <span className="truncate text-xs font-semibold text-black/85 dark:text-white/85">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-black/90 dark:text-white">{value}</div>
      <div className="truncate text-[9px] text-black/45 dark:text-white/45" title={caption}>{caption}</div>
    </div>
  );
}

/**
 * "Referral Network" card on the client overview: the client's referral
 * account at a glance (referred clients, pending / available / all-time
 * commission).
 */
export function ReferralNetworkCard({ clientId, className }: { clientId: string; className?: string }) {
  const { data, isLoading } = useVipOverview(clientId);
  const stats = data?.stats;
  const total = stats?.total ?? 0;
  const pending = stats?.pendingPayout ?? 0;
  const wallet = stats?.availableBalance ?? 0;
  const overall = stats?.overallPayout ?? 0;

  return (
    <div
      className={cn("rounded-sm border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]", className)}
      data-testid="referral-network-card"
    >
      <div className="flex items-center gap-2">
        <Users className="h-[22px] w-[22px] text-[#07a9f4]" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-black/90 dark:text-white">Referral Network</h3>
      </div>

      <div className="mt-4 rounded-sm border border-black/10 p-3 dark:border-white/10" data-testid="referral-stats-section">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-[#07a9f4]" strokeWidth={1.75} />
          <span className="text-[13px] font-semibold text-black/85 dark:text-white/85">Referral Account</span>
        </div>
        <div className={cn("mt-3 grid grid-cols-2 gap-2 2xl:grid-cols-4", isLoading && "animate-pulse")}>
          <StatTile icon={Megaphone} label="Referred" value={String(total)} caption="Total Clients" testId="stat-total-referred" />
          <StatTile icon={BanknoteArrowDown} label="Pending" value={currency.format(pending)} caption="Awaiting Approval" testId="stat-pending-commission" />
          <StatTile icon={Wallet} label="Wallet" value={currency.format(wallet)} caption="Available to Client" testId="stat-wallet-balance" />
          <StatTile icon={CirclePoundSterling} label="Overall" value={currency.format(overall)} caption="All-Time Commission" testId="stat-overall-commission" />
        </div>
      </div>
    </div>
  );
}
