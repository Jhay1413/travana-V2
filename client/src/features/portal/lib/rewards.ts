/**
 * Pure rules for the portal Rewards screen (VIP tier, referrals, wallet and the withdrawal request).
 * This is money: every figure and rule here is the one the screen has always used.
 */
import type { PortalReferral, PortalWalletTransaction, PortalWithdrawal, WithdrawRequestData } from "@/hooks/use-portal-api";

// ── Formatting ─────────────────────────────────────────────────────────────

/** "3 Nov 2026" from a date or date-time (read in the customer's time zone); "—" for nothing. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

/** A money string from the server as "£12.50"; "£0.00" for nothing. */
export function formatCurrency(amount: string | null | undefined): string {
  if (!amount) return "£0.00";
  return `£${parseFloat(amount).toFixed(2)}`;
}

/** A number of pounds as "£12.50". */
export function poundsText(amount: number): string {
  return `£${amount.toFixed(2)}`;
}

// ── VIP tier ───────────────────────────────────────────────────────────────

export type Tier = "not_enrolled" | "standard" | "gold" | "elite";

export interface TierInfo {
  label: string;
  nextTier: Tier | null;
  /** Referrals needed to reach the next tier. */
  nextAt: number;
  perks: string;
}

export const TIERS: Record<Tier, TierInfo> = {
  not_enrolled: { label: "Not Enrolled", nextTier: "standard", nextAt: 1, perks: "Complete a booking to join" },
  standard: { label: "Standard VIP", nextTier: "gold", nextAt: 3, perks: "25% commission reward per referral" },
  gold: { label: "Gold Member", nextTier: "elite", nextAt: 5, perks: "+£25 bonus credit · Priority offers" },
  elite: { label: "Elite Member", nextTier: null, nextAt: 0, perks: "+£50 extra credit · VIP perks" },
};

export function tierInfo(tier: string | null | undefined): TierInfo {
  return TIERS[(tier ?? "not_enrolled") as Tier] ?? TIERS.not_enrolled;
}

export interface TierProgress {
  info: TierInfo;
  next: TierInfo | null;
  /** 0 to 100; 100 at the top tier. */
  percent: number;
  /** Referrals still needed for the next tier (0 at the top tier). */
  remaining: number;
}

export function tierProgress(tier: string | null | undefined, referralCount: number): TierProgress {
  const info = tierInfo(tier);
  const next = info.nextTier ? TIERS[info.nextTier] : null;
  return {
    info,
    next,
    percent: info.nextTier ? Math.min(100, (referralCount / info.nextAt) * 100) : 100,
    remaining: info.nextTier ? Math.max(0, info.nextAt - referralCount) : 0,
  };
}

/** "Upgrade ready!" or "2 more referrals". */
export function remainingText(remaining: number): string {
  return remaining === 0 ? "Upgrade ready!" : `${remaining} more referral${remaining !== 1 ? "s" : ""}`;
}

export function referralCountText(total: number): string {
  return `${total} referral${total !== 1 ? "s" : ""}`;
}

// ── Referral balances ──────────────────────────────────────────────────────

type Status = PortalReferral["referralStatus"];

export const STATUS_LABELS: Record<Status, string> = {
  PENDING: "Pending",
  IN_WALLET: "In Your Wallet",
  PAID: "Paid Out",
  VOIDED: "Voided",
};

export function statusLabel(status: Status): string {
  return (STATUS_LABELS[status] ?? STATUS_LABELS.PENDING);
}

const payout = (r: PortalReferral) => parseFloat(r.payoutAmount ?? "0");
const sum = (referrals: PortalReferral[]) => referrals.reduce((total, r) => total + payout(r), 0);

/** Commission already released into the wallet (IN_WALLET referrals). */
export function availableFromReferrals(referrals: PortalReferral[]): number {
  return sum(referrals.filter((r) => r.referralStatus === "IN_WALLET"));
}

/** Commission still waiting for the trip (PENDING and not yet due). */
export function pendingFromReferrals(referrals: PortalReferral[]): number {
  return sum(referrals.filter((r) => r.referralStatus === "PENDING" && !r.isDue));
}

/** Lifetime commission paid out (PAID referrals), as the two-decimal string the screen has always passed around. */
export function totalPaidText(referrals: PortalReferral[]): string {
  return sum(referrals.filter((r) => r.referralStatus === "PAID")).toFixed(2);
}

/** Referrals that count towards the tier (everything except voided). */
export function activeReferrals(referrals: PortalReferral[]): PortalReferral[] {
  return referrals.filter((r) => r.referralStatus !== "VOIDED");
}

export function inWalletCount(referrals: PortalReferral[]): number {
  return referrals.filter((r) => r.referralStatus === "IN_WALLET").length;
}

/** The wallet balance the server reports, as a number (0 for nothing or something unreadable). */
export function parseBalance(balance: string | undefined): number {
  return parseFloat(balance ?? "0") || 0;
}

/** Total of the withdrawals still waiting for the agent. */
export function pendingWithdrawalTotal(withdrawals: PortalWithdrawal[]): number {
  return withdrawals.filter((w) => w.status === "pending").reduce((total, w) => total + parseFloat(w.amount ?? "0"), 0);
}

export function methodLabel(method: string | undefined): string {
  return method === "bank_transfer" ? "Bank transfer" : "Booking credit";
}

// ── Wallet history ─────────────────────────────────────────────────────────

export interface WalletEntry {
  id: string;
  type: "credit" | "debit";
  source: PortalWalletTransaction["source"];
  amount: string;
  status: PortalWalletTransaction["status"];
  date: string | null;
  referral_id: string | null;
}

/** The wallet's own records, rejected ones left out, newest first. */
export function walletEntries(transactions: PortalWalletTransaction[]): WalletEntry[] {
  return transactions
    .filter((tx) => tx.status !== "rejected")
    .map((tx) => ({
      id: tx.id,
      type: tx.type,
      source: tx.source,
      amount: tx.amount,
      status: tx.status,
      date: tx.processed_at ?? tx.created_at,
      referral_id: tx.referral_id,
    }))
    .sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
}

export interface EntryText {
  label: string;
  subtitle: string;
  /** "+£5.00" or "−£5.00" (a real minus sign). */
  amount: string;
  pending: boolean;
  credit: boolean;
}

export function describeEntry(entry: WalletEntry, referralNames: ReadonlyMap<string, string>): EntryText {
  const pending = entry.status === "pending";
  const credit = entry.type === "credit";
  const bookingCredit = entry.source === "booking_credit";
  const label = credit ? "Commission credited" : bookingCredit ? "Booking credit applied" : pending ? "Withdrawal requested" : "Withdrawal processed";
  const subtitle = credit && entry.referral_id ? (referralNames.get(entry.referral_id) ?? "") : bookingCredit ? "Applied to booking" : "Bank transfer";
  return { label, subtitle, amount: `${credit ? "+" : "−"}£${parseFloat(entry.amount).toFixed(2)}`, pending, credit };
}

/** How many processed commission credits are in the wallet (shown on the withdrawal sheet). */
export function commissionCount(transactions: PortalWalletTransaction[]): number {
  return transactions.filter((tx) => tx.type === "credit" && tx.status === "processed").length;
}

// ── Withdrawal request ─────────────────────────────────────────────────────

export type WithdrawMethod = WithdrawRequestData["method"];

export interface WithdrawForm {
  method: WithdrawMethod;
  accountName: string;
  accountNumber: string;
  sortCode: string;
}

export type WithdrawCheck = { ok: true; payload: WithdrawRequestData } | { ok: false; error: string };

/**
 * The checks made before a withdrawal is sent, and the request it sends: the whole available balance, by the chosen
 * method; a bank transfer also needs all three bank fields (any text, spaces trimmed, nothing else is checked here).
 */
export function checkWithdrawal(available: number, form: WithdrawForm): WithdrawCheck {
  if (available <= 0) return { ok: false, error: "You have no available balance to withdraw." };
  const payload: WithdrawRequestData = { method: form.method, amount: available.toFixed(2) };
  if (form.method === "bank_transfer") {
    if (!form.accountName.trim() || !form.accountNumber.trim() || !form.sortCode.trim()) {
      return { ok: false, error: "Please fill in all bank details before withdrawing." };
    }
    payload.account_name = form.accountName.trim();
    payload.account_number = form.accountNumber.trim();
    payload.sort_code = form.sortCode.trim();
  }
  return { ok: true, payload };
}
