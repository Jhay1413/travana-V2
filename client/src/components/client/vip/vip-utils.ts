import { Crown, Gem, Star } from "lucide-react";

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export const fmt = (n: number) => GBP.format(n);

export function formatVipDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const TIER_CONFIG = {
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

export type VipTier = keyof typeof TIER_CONFIG;
