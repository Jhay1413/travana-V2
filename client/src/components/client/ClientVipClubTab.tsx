import {
  Crown,
  Users,
  Wallet,
  CircleDollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Star,
  Gem,
  Receipt,
  Phone,
  Mail,
  UserPlus,
  Briefcase,
} from "lucide-react";
import { useVipOverview } from "@/hooks/queries/use-referral-queries";
import type { VipTransactionRow } from "@/api/endpoints/referral.api";

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const fmt = (n: number) => GBP.format(n);

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const TIER_CONFIG = {
  standard: {
    label: "VIP",
    icon: Star,
    bg: "from-slate-400/20 to-slate-500/20",
    border: "border-slate-400/30",
    text: "text-slate-700",
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    description: "1–2 referrals · 25% Commission Reward",
  },
  gold: {
    label: "Gold Member",
    icon: Crown,
    bg: "from-amber-400/20 to-yellow-400/20",
    border: "border-amber-400/30",
    text: "text-amber-700",
    badge: "bg-amber-50 text-amber-700 border-amber-300",
    description: "3–4 referrals · Bonus £25 Credit + Priority Offers",
  },
  elite: {
    label: "Elite Member",
    icon: Gem,
    bg: "from-purple-400/20 to-fuchsia-400/20",
    border: "border-purple-400/30",
    text: "text-purple-700",
    badge: "bg-purple-50 text-purple-700 border-purple-300",
    description: "5+ referrals · £50 Extra Credit + VIP Perks",
  },
} as const;

const STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200" },
  IN_WALLET: { label: "In Wallet", icon: Wallet, className: "bg-blue-50 text-blue-700 border-blue-200" },
  PAID: { label: "Paid", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  VOIDED: { label: "Voided", icon: XCircle, className: "bg-red-50 text-red-600 border-red-200" },
} as const;

function StatusBadge({ status }: { status: VipTransactionRow["referralStatus"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.className}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function DueBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
      <AlertCircle className="h-3 w-3" />
      Payout Due
    </span>
  );
}

interface Props {
  clientId: string;
}

export function ClientVipClubTab({ clientId }: Props) {
  const { data, isLoading } = useVipOverview(clientId);

  if (isLoading) {
    return (
      <div className="grid gap-3 animate-pulse" data-testid="vip-tab-loading">
        <div className="h-28 rounded-2xl border border-black/10 bg-black/[0.03]" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl border border-black/10 bg-black/[0.03]" />)}
        </div>
        <div className="h-48 rounded-2xl border border-black/10 bg-black/[0.03]" />
        <div className="h-48 rounded-2xl border border-black/10 bg-black/[0.03]" />
      </div>
    );
  }

  const tier = data?.vipTier ?? null;
  const tierCfg = tier ? TIER_CONFIG[tier] : null;
  const TierIcon = tierCfg?.icon ?? Star;
  const stats = data?.stats;
  const referredClients = data?.referredClients ?? [];
  const transactionHistory = data?.transactionHistory ?? [];

  return (
    <div className="grid gap-3" data-testid="panel-vip-club">

      {/* VIP Tier Card */}
      <div
        className={`rounded-2xl border p-4 bg-gradient-to-br ${tierCfg ? `${tierCfg.bg} ${tierCfg.border}` : "from-black/[0.02] to-black/[0.04] border-black/10"}`}
        data-testid="card-vip-tier"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${tierCfg ? `${tierCfg.border} bg-white/60` : "border-black/10 bg-white/60"}`}>
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
            {tier && (
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierCfg!.badge}`}>
                {tierCfg!.label}
              </span>
            )}
            {data?.vipEnrolledAt && (
              <div className="flex items-center gap-1 text-[11px] text-black/45">
                <Calendar className="h-3 w-3" />
                Enrolled {formatDate(data.vipEnrolledAt)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="vip-stats-grid">
        <div className="flex flex-col gap-1 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-3" data-testid="vip-stat-total">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-purple-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Referred</span>
          </div>
          <div className="text-2xl font-bold text-black/85">{stats?.total ?? 0}</div>
          <div className="text-[10px] text-black/40">Total clients referred</div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3" data-testid="vip-stat-pending">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Pending</span>
          </div>
          <div className="text-xl font-bold text-black/85">{fmt(stats?.pendingPayout ?? 0)}</div>
          <div className="text-[10px] text-black/40">{stats?.pendingCount ?? 0} awaiting payout</div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3" data-testid="vip-stat-wallet">
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Wallet</span>
          </div>
          <div className="text-xl font-bold text-black/85">{fmt(stats?.walletPayout ?? 0)}</div>
          <div className="text-[10px] text-black/40">{stats?.inWalletCount ?? 0} ready to withdraw</div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3" data-testid="vip-stat-overall">
          <div className="flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">All-time Earned</span>
          </div>
          <div className="text-xl font-bold text-black/85">{fmt(stats?.overallPayout ?? 0)}</div>
          <div className="text-[10px] text-black/40">{stats?.paidCount ?? 0} paid out</div>
        </div>
      </div>

      {/* Clients Referred */}
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="vip-referred-clients">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-purple-500" />
          <span className="text-xs font-semibold text-black/80">Clients Referred</span>
          {referredClients.length > 0 && (
            <span className="ml-auto rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-600">
              {referredClients.length}
            </span>
          )}
        </div>

        {referredClients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-6 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-black/15" />
            <p className="text-sm text-black/45">No clients referred yet</p>
            <p className="mt-0.5 text-xs text-black/35">Clients referred by this member will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {referredClients.map((c) => {
              const initials = [c.firstName?.[0], c.surename?.[0]].filter(Boolean).join("").toUpperCase() || "?";
              const name = [c.firstName, c.surename].filter(Boolean).join(" ") || "Unknown";
              return (
                <div key={c.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0" data-testid={`vip-referred-client-${c.id}`}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-xs font-bold text-purple-600">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-black/85">{name}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-black/45">
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />{c.email}
                        </span>
                      )}
                      {c.phoneNumber && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{c.phoneNumber}
                        </span>
                      )}
                    </div>
                  </div>
                  {c.createdAt && (
                    <div className="shrink-0 text-right text-[10px] text-black/35">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {formatDate(c.createdAt)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="vip-transaction-history">
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-semibold text-black/80">Transaction History</span>
          <span className="text-[10px] text-black/35 font-normal">(bookings earning commission)</span>
          {transactionHistory.length > 0 && (
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
              {transactionHistory.length}
            </span>
          )}
        </div>

        {transactionHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-6 text-center">
            <Briefcase className="mx-auto mb-2 h-8 w-8 text-black/15" />
            <p className="text-sm text-black/45">No transactions yet</p>
            <p className="mt-0.5 text-xs text-black/35">Bookings linked to referrals will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {transactionHistory.map((t) => {
              const clientName = t.referredClientFirstName && t.referredClientSurname
                ? `${t.referredClientFirstName} ${t.referredClientSurname}`
                : t.referredName;
              const bookingLabel = t.bookingTitle || clientName;
              const travelDate = t.bookingTravelDate || t.travelDate;
              const payout = t.payoutAmount ? parseFloat(t.payoutAmount) : 0;
              const commission = t.commission ? parseFloat(t.commission) : 0;
              return (
                <div key={t.id} className="py-3 first:pt-0 last:pb-0" data-testid={`vip-tx-row-${t.id}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-black/85">{bookingLabel}</span>
                        <StatusBadge status={t.referralStatus} />
                        {t.isDue && <DueBadge />}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-black/50">
                        <span className="text-black/45">Referred: {clientName}</span>
                        {travelDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Travel: {formatDate(travelDate)}
                          </span>
                        )}
                        {t.bookingHaysRef && (
                          <span className="text-black/35">Ref: {t.bookingHaysRef}</span>
                        )}
                        {t.paidAt && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Paid: {formatDate(t.paidAt)}
                          </span>
                        )}
                        {t.payoutTriggerDate && t.referralStatus === "PENDING" && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Trigger: {formatDate(t.payoutTriggerDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      {payout > 0 && (
                        <div className="text-sm font-bold text-black/80">
                          {fmt(payout)}
                          <span className="ml-1 text-[10px] font-normal text-black/40">payout</span>
                        </div>
                      )}
                      {commission > 0 && (
                        <div className="text-xs text-black/40">
                          Comm: {fmt(commission)}
                        </div>
                      )}
                      {t.bookingSalesPrice && parseFloat(t.bookingSalesPrice) > 0 && (
                        <div className="text-[10px] text-black/30">
                          Booking: {fmt(parseFloat(t.bookingSalesPrice))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
