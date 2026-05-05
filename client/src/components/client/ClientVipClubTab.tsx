import {
  Crown,
  Users,
  Wallet,
  CircleDollarSign,
  Clock,
  Calendar,
  Star,
  Gem,
  Receipt,
  Phone,
  Mail,
  UserPlus,
  Briefcase,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { useVipOverview } from "@/hooks/queries/use-referral-queries";
import type { VipWalletLedgerEntry, VipTransactionRow } from "@/api/endpoints/referral.api";

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
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl border border-black/10 bg-black/[0.03]" />)}
        </div>
        <div className="h-48 rounded-2xl border border-black/10 bg-black/[0.03]" />
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
  const walletLedger: VipWalletLedgerEntry[] = data?.walletLedger ?? [];
  const transactionHistory: VipTransactionRow[] = data?.transactionHistory ?? [];
  const pendingCommissions = transactionHistory.filter(
    (r) => r.referralStatus === "PENDING" || r.referralStatus === "IN_WALLET",
  );

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
            <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">Available</span>
          </div>
          <div className="text-xl font-bold text-black/85">{fmt(stats?.availableBalance ?? 0)}</div>
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

      {/* Transaction History (wallet ledger) */}
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="vip-transaction-history">
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-semibold text-black/80">Transaction History</span>
          {walletLedger.length > 0 && (
            <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
              {walletLedger.length}
            </span>
          )}
        </div>

        {walletLedger.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 bg-white/40 p-6 text-center">
            <Briefcase className="mx-auto mb-2 h-8 w-8 text-black/15" />
            <p className="text-sm text-black/45">No wallet activity yet</p>
            <p className="mt-0.5 text-xs text-black/35">Credits and withdrawals will appear here once commissions are released</p>
          </div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {walletLedger.map((entry) => {
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
                <div key={entry.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0" data-testid={`vip-ledger-row-${entry.id}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isCredit ? "bg-emerald-100" : "bg-orange-100"}`}>
                      {isCredit
                        ? <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-600" />
                        : <ArrowUpFromLine className="h-3.5 w-3.5 text-orange-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-black/80">{label}</span>
                        {isPending && (
                          <span className="text-[10px] font-semibold border rounded-full px-1.5 py-0.5 text-amber-600 bg-amber-50 border-amber-200">pending</span>
                        )}
                      </div>
                      <div className="text-[11px] text-black/40">
                        {subtitle && <span className="mr-2">{subtitle}</span>}
                        {formatDate(entry.processed_at ?? entry.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold leading-none whitespace-nowrap ${isCredit ? "text-emerald-600" : "text-orange-600"}`}>
                      {isCredit ? "+" : "−"}{fmt(parseFloat(entry.amount))}
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

    </div>
  );
}
