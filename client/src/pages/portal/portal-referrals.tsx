import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, Home, ChevronRight, Star, Crown, Shield, Clock, CheckCircle,
  Wallet, TrendingUp, User, Calendar, CreditCard, Banknote, X, AlertCircle,
  ChevronDown, Inbox,
} from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import {
  usePortalVipStatus,
  usePortalReferrals,
  useSetReferralPayoutType,
  type PortalReferral,
  type PortalVipStatus,
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

const STATUS_CONFIG = {
  PENDING: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/15", icon: Clock },
  IN_WALLET: { label: "In Wallet", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: Wallet },
  PAID: { label: "Paid", color: "text-blue-400", bg: "bg-blue-500/15", icon: CheckCircle },
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

// ── Redeem Modal ───────────────────────────────────────────────────────────

function RedeemModal({
  referrals,
  onClose,
}: {
  referrals: PortalReferral[];
  onClose: () => void;
}) {
  const setPayoutType = useSetReferralPayoutType();
  const eligible = referrals.filter((r) => r.referralStatus === "IN_WALLET");
  const [selections, setSelections] = useState<Record<string, "bank_transfer" | "booking_credit">>(() => {
    const init: Record<string, "bank_transfer" | "booking_credit"> = {};
    eligible.forEach((r) => {
      init[r.id] = r.payoutType ?? "bank_transfer";
    });
    return init;
  });
  const [saved, setSaved] = useState(false);

  const totalAvailable = eligible.reduce((sum, r) => sum + parseFloat(r.payoutAmount ?? "0"), 0);

  async function handleSave() {
    const changed = eligible.filter((r) => selections[r.id] !== r.payoutType);
    await Promise.all(
      changed.map((r) =>
        setPayoutType.mutateAsync({ id: r.id, payoutType: selections[r.id] })
      )
    );
    setSaved(true);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-lg bg-[#0f0f1a] border border-white/[0.12] rounded-t-3xl p-5 pb-8 max-h-[85vh] overflow-y-auto"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Redeem Rewards</h2>
            <p className="text-white/40 text-sm">Total available: <span className="text-emerald-400 font-semibold">£{totalAvailable.toFixed(2)}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.08] flex items-center justify-center text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {eligible.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 font-medium">Nothing to redeem yet</p>
            <p className="text-white/30 text-sm mt-1">Rewards become available 8 weeks before your friend's travel date</p>
          </div>
        ) : saved ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-semibold text-lg">Preferences saved!</p>
            <p className="text-white/40 text-sm mt-1">Your agent will be in touch to process your reward.</p>
            <button
              onClick={onClose}
              className="mt-5 px-6 py-2.5 rounded-2xl bg-white/[0.08] text-white text-sm font-medium hover:bg-white/[0.12] transition-all"
            >
              Close
            </button>
          </motion.div>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              {eligible.map((r) => (
                <GlassCard key={r.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-white/40" />
                      <span className="text-white font-medium text-sm">{r.referredName}</span>
                    </div>
                    <span className="text-emerald-400 font-bold">{formatCurrency(r.payoutAmount)}</span>
                  </div>
                  <p className="text-white/30 text-xs mb-3 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Travel: {formatDate(r.travelDate)}
                  </p>
                  {/* Payout method toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSelections((s) => ({ ...s, [r.id]: "bank_transfer" }))}
                      className={`flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all border ${
                        selections[r.id] === "bank_transfer"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60"
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      Bank Transfer
                    </button>
                    <button
                      onClick={() => setSelections((s) => ({ ...s, [r.id]: "booking_credit" }))}
                      className={`flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all border ${
                        selections[r.id] === "booking_credit"
                          ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                          : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/60"
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Booking Credit
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>

            <motion.button
              onClick={handleSave}
              disabled={setPayoutType.isPending}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm disabled:opacity-50 transition-all"
            >
              {setPayoutType.isPending ? "Saving…" : "Save Preferences"}
            </motion.button>
            <p className="text-white/30 text-xs text-center mt-3">
              Your agent will process your payment after confirming your details.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
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
                {referral.payoutType && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Payout method</span>
                    <span className="text-white/70 capitalize">{referral.payoutType.replace("_", " ")}</span>
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

export default function PortalReferralsPage() {
  const [, setLocation] = useLocation();
  const [showRedeem, setShowRedeem] = useState(false);

  const { data: vip, isLoading: vipLoading } = usePortalVipStatus();
  const { data: referrals = [], isLoading: referralsLoading } = usePortalReferrals();

  const loading = vipLoading || referralsLoading;
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center">
            <Gift className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Rewards</h1>
            <p className="text-white/40 text-xs">Refer friends · Earn commission</p>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : (
          <div className="space-y-4">
            {/* VIP Tier Card */}
            <div className="relative overflow-hidden rounded-3xl">
              <TierProgressCard vip={vipData} referralCount={activeReferrals.length} />
            </div>

            {/* Balance Cards */}
            <BalanceCards referrals={referrals} totalEarnings={vipData.totalEarnings} />

            {/* Redeem Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowRedeem(true)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Wallet className="w-4 h-4" />
              Redeem Rewards
              {availableCount > 0 && (
                <span className="ml-1 w-5 h-5 rounded-full bg-white/20 text-white text-xs flex items-center justify-center">
                  {availableCount}
                </span>
              )}
            </motion.button>

            {/* How it works */}
            <GlassCard className="p-4">
              <p className="text-white/60 text-xs font-medium mb-2">How it works</p>
              <div className="space-y-2">
                {[
                  { step: "1", text: "Tell a friend to mention your name when booking" },
                  { step: "2", text: "Your referral is logged and tracked" },
                  { step: "3", text: "8 weeks before their trip, your reward is released" },
                  { step: "4", text: "Choose bank transfer or booking credit" },
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

            {/* Recent Referrals */}
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
          </div>
        )}
      </div>

      {/* Redeem Modal */}
      <AnimatePresence>
        {showRedeem && (
          <RedeemModal referrals={referrals} onClose={() => setShowRedeem(false)} />
        )}
      </AnimatePresence>
    </PortalLayout>
  );
}
