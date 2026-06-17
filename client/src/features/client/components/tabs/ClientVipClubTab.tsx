import { useLocation } from "wouter";
import { useVipOverview } from "@/features/referral/api/use-referral-queries";
import { VipTierCard } from "../vip/VipTierCard";
import { VipStatsGrid } from "../vip/VipStatsGrid";
import { VipPendingCommissions } from "../vip/VipPendingCommissions";
import { VipReferredClients } from "../vip/VipReferredClients";
import { VipTransactionHistory } from "../vip/VipTransactionHistory";

interface Props {
  clientId: string;
}

export function ClientVipClubTab({ clientId }: Props) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useVipOverview(clientId);

  if (isLoading) {
    return (
      <div className="grid gap-3 animate-pulse" data-testid="vip-tab-loading">
        <div className="h-28 rounded-2xl border border-black/10 bg-black/[0.03]" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl border border-black/10 bg-black/[0.03]" />
          ))}
        </div>
        <div className="h-48 rounded-2xl border border-black/10 bg-black/[0.03]" />
        <div className="h-48 rounded-2xl border border-black/10 bg-black/[0.03]" />
        <div className="h-48 rounded-2xl border border-black/10 bg-black/[0.03]" />
      </div>
    );
  }

  return (
    <div className="grid gap-3" data-testid="panel-vip-club">
      <VipTierCard tier={data?.vipTier ?? null} enrolledAt={data?.vipEnrolledAt} />
      <VipStatsGrid stats={data?.stats} />
      <VipPendingCommissions rows={data?.transactionHistory ?? []} />
      <VipReferredClients clients={data?.referredClients ?? []} />
      <VipTransactionHistory ledger={data?.walletLedger ?? []} clientId={clientId} navigate={navigate} />
    </div>
  );
}
