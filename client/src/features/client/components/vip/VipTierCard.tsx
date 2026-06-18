import { Calendar, Star } from "lucide-react";
import { TIER_CONFIG, formatVipDate, type VipTier } from "./vip-utils";

interface VipTierCardProps {
  tier: VipTier | null;
  enrolledAt: string | null | undefined;
}

export function VipTierCard({ tier, enrolledAt }: VipTierCardProps) {
  const tierCfg = tier ? TIER_CONFIG[tier] : null;
  const TierIcon = tierCfg?.icon ?? Star;

  return (
    <div
      className={`rounded-2xl border p-4 bg-gradient-to-br ${
        tierCfg
          ? `${tierCfg.bg} ${tierCfg.border}`
          : "from-black/[0.02] to-black/[0.04] border-black/10"
      }`}
      data-testid="card-vip-tier"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
              tierCfg ? `${tierCfg.border} bg-white/60` : "border-black/10 bg-white/60"
            }`}
          >
            <TierIcon className={`h-5 w-5 ${tierCfg?.text ?? "text-black/40"}`} />
          </div>
          <div>
            <div className={`text-sm font-bold ${tierCfg?.text ?? "text-black/50"}`}>
              {tierCfg?.label ?? "Not Enrolled"}
            </div>
            <div className="text-xs text-black/50">
              {tierCfg?.description ?? "No VIP tier assigned yet"}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          {tier && tierCfg && (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierCfg.badge}`}>
              {tierCfg.label}
            </span>
          )}
          {enrolledAt && (
            <div className="flex items-center gap-1 text-[11px] text-black/45">
              <Calendar className="h-3 w-3" />
              Enrolled {formatVipDate(enrolledAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
