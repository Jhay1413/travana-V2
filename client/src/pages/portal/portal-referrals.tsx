import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, Home, ChevronRight, Star, Crown, Shield, Clock, CheckCircle,
  Wallet, TrendingUp, User, CreditCard, Banknote, X, AlertCircle,
  ChevronDown, Inbox, ArrowDownToLine, ArrowUpFromLine, History,
} from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import {
  usePortalVipStatus,
  usePortalReferrals,
  usePortalWithdrawals,
  useRequestWalletWithdraw,
  type PortalReferral,
  type PortalVipStatus,
  type PortalWithdrawal,
  type WithdrawRequestData,
} from "@/hooks/use-portal-api";

// ── Helpers ────────────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.08] rounded-2xl ${className}`} />;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: string | null | undefined): string {
  if (!amount) return "£0.00";
  return `£${parseFloat(amount).toFixed(2)}`;
}

// ── Tier config ────────────────────────────────────────────────────────────

type Tier = "not_enrolled" | "standard" | "gold" | "elite";

const TIER_CONFIG: Record<Tier, {
  label: string;
  icon: React.ElementType;
  gradient: string;
  badge: string;
  ring: string;
  nextTier: Tier | null;
  nextAt: number;
  perks: string;
}> = {
  not_enrolled: {
    label: "Not Enrolled",
    icon: Shield,
    gradient: "from-white/20 to-white/10",
    badge: "bg-white/10 text-white/50",
    ring: "border-white/20",
    nextTier: "standard",
    nextAt: 1,
    perks: "Complete a booking to join",
  },
  standard: {
    label: "Standard VIP",
    icon: Shield,
    gradient: "from-blue-500/30 to-cyan-500/30",
    badge: "bg-blue-500/20 text-blue-300",
    ring: "border-blue-500/30",
    nextTier: "gold",
    nextAt: 3,
    perks: "25% commission reward per referral",
  },
  gold: {
    label: "Gold Member",
    icon: Star,
    gradient: "from-amber-500/30 to-yellow-500/30",
    badge: "bg-amber-500/20 text-amber-300",
    ring: "border-amber-500/30",
    nextTier: "elite",
    nextAt: 5,
    perks: "+£25 bonus credit · Priority offers",
  },
  elite: {
    label: "Elite Member",
    icon: Crown,
    gradient: "from-purple-500/30 to-pink-500/30",
    badge: "bg-purple-500/20 text-purple-300",
    ring: "border-purple-500/30",
    nextTier: null,
    nextAt: 0,
    perks: "+£50 extra credit · VIP perks",
  },
};

const STATUS_CONFIG: Record<PortalReferral["referralStatus"], { label: string; color: string; bg: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/15", icon: Clock },
  IN_WALLET: { label: "In Your Wallet", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: Wallet },
  PAID: { label: "Paid Out", color: "text-blue-400", bg: "bg-blue-500/15", icon: CheckCircle },
  VOIDED: { label: "Voided", color: "text-white/30", bg: "bg-white/5", icon: X },
};

// ── Sub-components ─────────────────────────────────────────────────────────

function TierProgressCard({ vip, referralCount }: { vip: PortalVipStatus; referralCount: number }) {
  const tier = (vip.vipTier ?? "not_enrolled") as Tier;
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.icon;
  const total = referralCount;

  const progressPct = cfg.nextTier
    ? Math.min(100, (total / cfg.nextAt) * 100)
    : 100;

  const remaining = cfg.nextTier ? Math.max(0, cfg.nextAt - total) : 0;

  return (
    <GlassCard className={`p-5 border ${cfg.ring}`}>
      <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${cfg.gradient} opacity-40 pointer-events-none`} />
      <div className="relative">
        {/* Tier header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${cfg.gradient} border ${cfg.ring} flex items-center justify-center`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white/50 text-xs">Current tier</p>
              <p className="text-white font-bold text-lg leading-tight">{cfg.label}</p>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
            {total} referral{total !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Perks */}
        <p className="text-white/50 text-xs mb-4">{cfg.perks}</p>

        {/* Progress */}
        {cfg.nextTier ? (
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-white/40">Progress to {TIER_CONFIG[cfg.nextTier].label}</span>
              <span className="text-white/70 font-medium">
                {remaining === 0
                  ? "Upgrade ready!"
                  : `${remaining} more referral${remaining !== 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${cfg.gradient.replace("/30", "").replace("/20", "")}`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1.5 text-white/30">
              <span>{cfg.label}</span>
              <span>{TIER_CONFIG[cfg.nextTier].label}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-purple-300 text-sm">
            <Crown className="w-4 h-4" />
            <span className="font-medium">You've reached the top tier!</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function BalanceCards({
  referrals,
  totalEarnings,
}: {
  referrals: PortalReferral[];
  totalEarnings: string;
}) {
  const availableBalance = referrals
    .filter((r) => r.referralStatus === "IN_WALLET")
    .reduce((sum, r) => sum + parseFloat(r.payoutAmount ?? "0"), 0);

  const pendingBalance = referrals
    .filter((r) => r.referralStatus === "PENDING")
    .reduce((sum, r) => sum + parseFloat(r.payoutAmount ?? "0"), 0);

  const cards = [
    {
      label: "Available",
      sublabel: "Ready to redeem",
      value: `£${availableBalance.toFixed(2)}`,
      icon: Wallet,
      gradient: "from-emerald-500/20 to-teal-500/20",
      border: "border-emerald-500/20",
      color: "text-emerald-400",
    },
    {
      label: "Pending",
      sublabel: "Awaiting travel",
      value: `£${pendingBalance.toFixed(2)}`,
      icon: Clock,
      gradient: "from-amber-500/20 to-yellow-500/20",
      border: "border-amber-500/20",
      color: "text-amber-400",
    },
    {
      label: "Total Paid",
      sublabel: "Lifetime earnings",
      value: `£${parseFloat(totalEarnings || "0").toFixed(2)}`,
      icon: TrendingUp,
      gradient: "from-blue-500/20 to-cyan-500/20",
      border: "border-blue-500/20",
      color: "text-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <GlassCard key={card.label} className={`p-3 border ${card.border} relative overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50 pointer-events-none`} />
            <div className="relative">
              <Icon className={`w-4 h-4 ${card.color} mb-2`} />
              <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              <p className="text-white/60 text-xs font-medium leading-tight">{card.label}</p>
              <p className="text-white/30 text-[10px] leading-tight">{card.sublabel}</p>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

// ── Shared bottom-sheet wrapper ────────────────────────────────────────────

function BottomSheet({ title: _title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg bg-[#0f0f1a] border border-white/[0.12] rounded-t-3xl p-5 pb-28 max-h-[85vh] overflow-y-auto"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Withdraw Modal (IN_WALLET → choose method + bank details, agent processes → PAID) ────

function WithdrawModal({
  referrals,
  withdrawals,
  onClose,
}: {
  referrals: PortalReferral[];
  withdrawals: PortalWithdrawal[];
  onClose: () => void;
}) {
  const withdraw = useRequestWalletWithdraw();
  // Exclude referrals that already have a pending withdrawal
  const pendingReferralIds = new Set(
    withdrawals.filter((w) => w.status === "pending").map((w) => w.referral_id)
  );
  const eligible = referrals.filter(
    (r) => r.referralStatus === "IN_WALLET" && !pendingReferralIds.has(r.id)
  );
  const [method, setMethod] = useState<"bank_transfer" | "booking_credit">("bank_transfer");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const totalAvailable = eligible.reduce((sum, r) => sum + parseFloat(r.payoutAmount ?? "0"), 0);

  async function handleWithdraw() {
    setValidationError(null);
    const payload: WithdrawRequestData = { method };
    if (method === "bank_transfer") {
      if (!accountName.trim() || !accountNumber.trim() || !sortCode.trim()) {
        setValidationError("Please fill in all bank details before withdrawing.");
        return;
      }
      payload.account_name = accountName.trim();
      payload.account_number = accountNumber.trim();
      payload.sort_code = sortCode.trim();
    }
    await withdraw.mutateAsync(payload);
    setDone(true);
  }

  return (
    <BottomSheet title="Withdraw" onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white font-bold text-lg">Withdraw Funds</h2>
          <p className="text-white/40 text-sm">{eligible.length} referral{eligible.length !== 1 ? "s" : ""} in wallet</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {eligible.length === 0 ? (
        <div className="text-center py-8">
          <Wallet className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 font-medium">Wallet is empty</p>
          <p className="text-white/30 text-sm mt-1">Commissions are released automatically 8 weeks before your friend's travel date</p>
        </div>
      ) : done ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-white font-semibold text-lg">Withdrawal requested!</p>
          <p className="text-emerald-400 font-bold text-2xl mt-1">£{totalAvailable.toFixed(2)}</p>
          <p className="text-white/40 text-sm mt-2">{method === "bank_transfer" ? "Bank transfer" : "Booking credit"}</p>
          <p className="text-white/30 text-xs mt-3">Your agent will process your payment shortly.</p>
          <button onClick={onClose} className="mt-5 px-6 py-2.5 rounded-2xl bg-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.12] transition-all">
            Close
          </button>
        </motion.div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/20 rounded-2xl p-4 mb-5 text-center">
            <Wallet className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-400 font-bold text-3xl">£{totalAvailable.toFixed(2)}</p>
            <p className="text-white/40 text-xs mt-1">Available across {eligible.length} referral{eligible.length !== 1 ? "s" : ""}</p>
          </div>

          <div className="space-y-2 mb-5">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-2">Breakdown</p>
            {eligible.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                  <span className="text-white/70 text-sm truncate">{r.referredName}</span>
                </div>
                <span className="text-emerald-400 font-semibold text-sm flex-shrink-0">{formatCurrency(r.payoutAmount)}</span>
              </div>
            ))}
          </div>

          <div className="mb-5">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide mb-2">How would you like it?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMethod("bank_transfer")}
                className={`flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl text-sm font-medium transition-all border ${
                  method === "bank_transfer"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60"
                }`}
              >
                <Banknote className="w-5 h-5" />
                Bank Transfer
              </button>
              <button
                onClick={() => setMethod("booking_credit")}
                className={`flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl text-sm font-medium transition-all border ${
                  method === "booking_credit"
                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                    : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60"
                }`}
              >
                <CreditCard className="w-5 h-5" />
                Booking Credit
              </button>
            </div>
          </div>

          {/* Bank details — only for bank transfer */}
          {method === "bank_transfer" && (
            <div className="mb-5 space-y-3">
              <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Your Bank Details</p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account number"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <input
                  type="text"
                  value={sortCode}
                  onChange={(e) => setSortCode(e.target.value)}
                  placeholder="Sort code (e.g. 12-34-56)"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <p className="text-white/25 text-xs">Your agent will transfer directly to this account.</p>
            </div>
          )}

          {(validationError || withdraw.isError) && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-sm text-center">
              {validationError ?? (withdraw.error as Error)?.message ?? "Something went wrong. Please try again."}
            </div>
          )}
          <motion.button
            onClick={handleWithdraw}
            disabled={withdraw.isPending}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm disabled:opacity-50 transition-all"
          >
            {withdraw.isPending ? "Requesting…" : `Withdraw £${totalAvailable.toFixed(2)}`}
          </motion.button>
          <p className="text-white/30 text-xs text-center mt-3">
            Your agent will process your payment after confirming your details.
          </p>
        </>
      )}
    </BottomSheet>
  );
}

// ── Referral Progress ──────────────────────────────────────────────────────

const PROGRESS_STEPS: { key: PortalReferral["referralStatus"]; label: string }[] = [
  { key: "PENDING", label: "Logged" },
  { key: "IN_WALLET", label: "In Wallet" },
  { key: "PAID", label: "Paid Out" },
];

function ReferralProgress({ status }: { status: PortalReferral["referralStatus"] }) {
  const activeIdx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-1 py-3">
      {PROGRESS_STEPS.map((step, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  done
                    ? "bg-emerald-500/30 border border-emerald-500/50"
                    : active
                    ? "bg-violet-500/30 border border-violet-400/60 ring-2 ring-violet-400/20"
                    : "bg-white/[0.05] border border-white/[0.1]"
                }`}
              >
                {done ? (
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                ) : active ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 text-center truncate w-full px-0.5 ${
                  done ? "text-emerald-400/70" : active ? "text-violet-300 font-medium" : "text-white/20"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < PROGRESS_STEPS.length - 1 && (
              <div
                className={`h-px flex-1 mx-1 -mt-4 transition-all ${
                  done ? "bg-emerald-500/30" : "bg-white/[0.07]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Referral Card ──────────────────────────────────────────────────────────

function ReferralCard({ referral, index }: { referral: PortalReferral; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[referral.referralStatus] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      <GlassCard className="overflow-hidden">
        <button
          className="w-full p-4 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white/40" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-medium text-sm truncate">{referral.referredName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                  {referral.isDue && referral.referralStatus === "PENDING" && (
                    <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                      <AlertCircle className="w-3 h-3" />
                      Due
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {referral.payoutAmount && referral.referralStatus !== "VOIDED" && (
                <span className="text-white font-semibold text-sm">{formatCurrency(referral.payoutAmount)}</span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-white/30 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0 border-t border-white/[0.06] space-y-2 text-sm">
                {/* Progress steps */}
                {referral.referralStatus !== "VOIDED" && (
                  <ReferralProgress status={referral.referralStatus} />
                )}
                {referral.referredEmail && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Email</span>
                    <span className="text-white/70">{referral.referredEmail}</span>
                  </div>
                )}
                {referral.travelDate && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Travel date</span>
                    <span className="text-white/70">{formatDate(referral.travelDate)}</span>
                  </div>
                )}
                {referral.payoutTriggerDate && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Payout due</span>
                    <span className="text-white/70">{formatDate(referral.payoutTriggerDate)}</span>
                  </div>
                )}
                {referral.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Paid on</span>
                    <span className="text-emerald-400">{formatDate(referral.paidAt)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/40">Referred on</span>
                  <span className="text-white/50 text-xs">{formatDate(referral.createdAt)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

// ── Wallet Tab ─────────────────────────────────────────────────────────────

type WalletEntry =
  | { type: "credit"; id: string; referredName: string; amount: string; date: string | null }
  | { type: "withdrawal"; id: string; referredName: string; amount: string; date: string | null; method: string; status: "pending" | "processed" | "rejected" };

function WalletTab({
  referrals,
  withdrawals,
  totalEarnings,
  onWithdraw,
}: {
  referrals: PortalReferral[];
  withdrawals: PortalWithdrawal[];
  totalEarnings: string;
  onWithdraw: () => void;
}) {
  const walletBalance = referrals
    .filter((r) => r.referralStatus === "IN_WALLET")
    .reduce((sum, r) => sum + parseFloat(r.payoutAmount ?? "0"), 0);

  // Referrals that are IN_WALLET but already have a pending withdrawal
  const pendingWithdrawalReferralIds = new Set(
    withdrawals.filter((w) => w.status === "pending").map((w) => w.referral_id)
  );
  const withdrawableBalance = referrals
    .filter((r) => r.referralStatus === "IN_WALLET" && !pendingWithdrawalReferralIds.has(r.id))
    .reduce((sum, r) => sum + parseFloat(r.payoutAmount ?? "0"), 0);

  const pendingBalance = referrals
    .filter((r) => r.referralStatus === "PENDING")
    .reduce((sum, r) => sum + parseFloat(r.payoutAmount ?? "0"), 0);

  const pendingWithdrawalBalance = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + parseFloat(w.amount ?? "0"), 0);

  const totalPaid = parseFloat(totalEarnings || "0");

  // Build chronological transaction history
  const entries: WalletEntry[] = [];

  // Credits: every referral that entered IN_WALLET (status is IN_WALLET or PAID)
  referrals
    .filter((r) => r.referralStatus === "IN_WALLET" || r.referralStatus === "PAID")
    .forEach((r) => {
      entries.push({
        type: "credit",
        id: `credit-${r.id}`,
        referredName: r.referredName,
        amount: r.payoutAmount ?? "0",
        date: r.payoutTriggerDate ?? r.createdAt,
      });
    });

  // Withdrawals: all referral_withdrawal records
  withdrawals.forEach((w) => {
    entries.push({
      type: "withdrawal",
      id: `withdrawal-${w.id}`,
      referredName: "Withdrawal",
      amount: w.amount,
      date: w.processed_at ?? w.requested_at,
      method: w.method,
      status: w.status,
    });
  });

  // Sort newest first
  entries.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");

  return (
    <div className="space-y-4">
      {/* Balance hero */}
      <GlassCard className="p-5 border border-emerald-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wide">Available Balance</p>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-emerald-400 font-bold text-4xl mb-1">£{withdrawableBalance.toFixed(2)}</p>
          <p className="text-white/30 text-xs">
            {withdrawableBalance > 0
              ? `${referrals.filter((r) => r.referralStatus === "IN_WALLET" && !pendingWithdrawalReferralIds.has(r.id)).length} referral${referrals.filter((r) => r.referralStatus === "IN_WALLET" && !pendingWithdrawalReferralIds.has(r.id)).length !== 1 ? "s" : ""} ready to withdraw`
              : "No available balance"}
          </p>

          {/* Mini stats row */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-wide">Unreleased</p>
              <p className="text-amber-400 font-semibold text-sm">£{pendingBalance.toFixed(2)}</p>
              <p className="text-white/20 text-[10px]">Not yet due</p>
            </div>
            <div>
              <p className="text-white/30 text-[10px] uppercase tracking-wide">Total Paid Out</p>
              <p className="text-blue-400 font-semibold text-sm">£{totalPaid.toFixed(2)}</p>
              <p className="text-white/20 text-[10px]">Lifetime earnings</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Pending withdrawal banner — shown when client is waiting for agent to process */}
      {pendingWithdrawalBalance > 0 && (
        <GlassCard className="p-4 border border-orange-500/25 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/8 to-amber-500/8 pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0">
              <ArrowUpFromLine className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-orange-300 font-semibold text-sm">Withdrawal Pending</p>
              <p className="text-white/40 text-xs mt-0.5">
                £{pendingWithdrawalBalance.toFixed(2)} · {pendingWithdrawals[0]?.method === "bank_transfer" ? "Bank transfer" : "Booking credit"} · Awaiting agent approval
              </p>
            </div>
            <span className="text-orange-400 font-bold text-base flex-shrink-0">£{pendingWithdrawalBalance.toFixed(2)}</span>
          </div>
        </GlassCard>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        {withdrawableBalance > 0 && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onWithdraw}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Wallet className="w-4 h-4" />
            Withdraw · £{withdrawableBalance.toFixed(2)}
          </motion.button>
        )}
      </div>

      {/* Transaction history */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-white/30" />
          <p className="text-white/70 text-sm font-semibold">Transaction History</p>
        </div>

        {entries.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Wallet className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 font-medium text-sm">No wallet activity yet</p>
            <p className="text-white/30 text-xs mt-1">
              Commissions appear here once your referrals are released (8 weeks before travel).
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                {(() => {
                  const isPendingWithdrawal = entry.type === "withdrawal" && entry.status === "pending";
                  const borderClass = entry.type === "credit"
                    ? "border-emerald-500/10"
                    : isPendingWithdrawal
                    ? "border-amber-500/20"
                    : "border-blue-500/10";
                  const iconBg = entry.type === "credit"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : isPendingWithdrawal
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-blue-500/15 text-blue-400";
                  const amountColor = entry.type === "credit"
                    ? "text-emerald-400"
                    : isPendingWithdrawal
                    ? "text-amber-400"
                    : "text-blue-400";
                  const label = entry.type === "credit"
                    ? "Commission credited"
                    : isPendingWithdrawal
                    ? "Withdrawal requested"
                    : "Withdrawal processed";
                  return (
                    <GlassCard className={`px-4 py-3 border ${borderClass}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                            {entry.type === "credit"
                              ? <ArrowDownToLine className="w-4 h-4" />
                              : <ArrowUpFromLine className="w-4 h-4" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-white/80 text-sm font-medium truncate">{label}</p>
                              {isPendingWithdrawal && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 flex-shrink-0">
                                  Pending
                                </span>
                              )}
                            </div>
                            <p className="text-white/30 text-xs truncate">
                              {entry.referredName}
                              {entry.type === "withdrawal" && (
                                <span className="ml-1">· {entry.method === "bank_transfer" ? "Bank transfer" : "Booking credit"}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className={`font-semibold text-sm ${amountColor}`}>
                            {entry.type === "credit" ? "+" : "−"}£{parseFloat(entry.amount).toFixed(2)}
                          </p>
                          <p className="text-white/25 text-[10px]">{formatDate(entry.date)}</p>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })()}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page skeletons ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-44 w-full" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const DEFAULT_VIP: PortalVipStatus = {
  vipTier: "not_enrolled",
  vipEnrolledAt: null,
  totalReferrals: 0,
  totalEarnings: "0.00",
};

type PageTab = "referrals" | "wallet";

export default function PortalReferralsPage() {
  const [, setLocation] = useLocation();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [tab, setTab] = useState<PageTab>("referrals");

  const { data: vip, isLoading: vipLoading } = usePortalVipStatus();
  const { data: referrals = [], isLoading: referralsLoading } = usePortalReferrals();
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = usePortalWithdrawals();

  const loading = vipLoading || referralsLoading || withdrawalsLoading;
  const vipData = vip ?? DEFAULT_VIP;

  const activeReferrals = referrals.filter((r) => r.referralStatus !== "VOIDED");
  const availableCount = referrals.filter((r) => r.referralStatus === "IN_WALLET").length;

  return (
    <PortalLayout>
      <div className="px-4 pt-6 pb-6 max-w-lg mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-4 text-xs">
          <button
            onClick={() => setLocation("/portal")}
            className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
          >
            <Home className="w-3 h-3" /> Home
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/70">Rewards</span>
        </div>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <Gift className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Rewards</h1>
            <p className="text-white/40 text-xs">Refer friends · Earn commission</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.08] rounded-2xl p-1 mb-5">
          <button
            onClick={() => setTab("referrals")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              tab === "referrals"
                ? "bg-white/[0.10] text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            Referrals
            {activeReferrals.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-white/10 text-white/60 text-[10px] flex items-center justify-center">
                {activeReferrals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("wallet")}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
              tab === "wallet"
                ? "bg-white/[0.10] text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            Wallet
            {availableCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-400 text-[10px] flex items-center justify-center">
                {availableCount}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            {tab === "referrals" ? (
              <motion.div
                key="referrals"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {/* VIP Tier Card */}
                <div className="relative overflow-hidden rounded-3xl">
                  <TierProgressCard vip={vipData} referralCount={activeReferrals.length} />
                </div>

                {/* Balance Cards */}
                <BalanceCards referrals={referrals} totalEarnings={vipData.totalEarnings} />

                {/* How it works */}
                <GlassCard className="p-4">
                  <p className="text-white/60 text-xs font-medium mb-2">How it works</p>
                  <div className="space-y-2">
                    {[
                      { step: "1", text: "Tell a friend to mention your name when booking" },
                      { step: "2", text: "Your referral is logged and tracked" },
                      { step: "3", text: "8 weeks before their trip, your reward is automatically added to your wallet" },
                      { step: "4", text: "Request a withdrawal — bank transfer or booking credit" },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {item.step}
                        </span>
                        <p className="text-white/40 text-xs leading-relaxed">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* Referral list */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white/70 text-sm font-semibold">Your Referrals</p>
                    {activeReferrals.length > 0 && (
                      <span className="text-white/30 text-xs">{activeReferrals.length} total</span>
                    )}
                  </div>

                  {activeReferrals.length === 0 ? (
                    <GlassCard className="p-8 text-center">
                      <Inbox className="w-10 h-10 text-white/20 mx-auto mb-3" />
                      <p className="text-white/50 font-medium text-sm">No referrals yet</p>
                      <p className="text-white/30 text-xs mt-1">
                        When your agent logs a referral for you, it will appear here.
                      </p>
                    </GlassCard>
                  ) : (
                    <div className="space-y-2">
                      {activeReferrals.map((referral, idx) => (
                        <ReferralCard key={referral.id} referral={referral} index={idx} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="wallet"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                <WalletTab
                  referrals={referrals}
                  withdrawals={withdrawals}
                  totalEarnings={vipData.totalEarnings}
                  onWithdraw={() => setShowWithdraw(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdraw && (
          <WithdrawModal referrals={referrals} withdrawals={withdrawals} onClose={() => setShowWithdraw(false)} />
        )}
      </AnimatePresence>
    </PortalLayout>
  );
}
