import { describe, it, expect } from "vitest";
import type { PortalReferral, PortalWalletTransaction, PortalWithdrawal } from "@/hooks/use-portal-api";
import {
  activeReferrals,
  availableFromReferrals,
  checkWithdrawal,
  commissionCount,
  describeEntry,
  formatCurrency,
  formatDate,
  inWalletCount,
  parseBalance,
  pendingFromReferrals,
  pendingWithdrawalTotal,
  poundsText,
  remainingText,
  referralCountText,
  tierProgress,
  totalPaidText,
  walletEntries,
  type WalletEntry,
} from "./rewards";

const ref = (over: Partial<PortalReferral>): PortalReferral => ({
  id: "r",
  referredName: "Sam Friend",
  referralStatus: "PENDING",
  isDue: false,
  createdAt: "2026-01-01T00:00:00Z",
  payoutAmount: "10.00",
  ...over,
});

const tx = (over: Partial<PortalWalletTransaction>): PortalWalletTransaction => ({
  id: "t",
  type: "credit",
  amount: "10.00",
  source: "referral_commission",
  referral_id: null,
  booking_id: null,
  status: "processed",
  created_at: "2026-03-01T10:00:00Z",
  processed_at: null,
  ...over,
});

describe("money formatting (unchanged)", () => {
  it("shows server strings with two decimals and a pound sign", () => {
    expect(formatCurrency("12.5")).toBe("£12.50");
    expect(formatCurrency("0")).toBe("£0.00");
    expect(formatCurrency(null)).toBe("£0.00");
    expect(formatCurrency(undefined)).toBe("£0.00");
    expect(poundsText(7)).toBe("£7.00");
    expect(poundsText(1234.5)).toBe("£1234.50");
  });

  it("shows a dash for no date", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("2026-11-03T00:00:00Z")).toContain("2026");
  });
});

describe("tierProgress", () => {
  it("measures progress to the next tier and counts the referrals still needed", () => {
    const p = tierProgress("standard", 1);
    expect(p.info.label).toBe("Standard VIP");
    expect(p.next?.label).toBe("Gold Member");
    expect(p.percent).toBeCloseTo(33.33, 1);
    expect(p.remaining).toBe(2);
  });

  it("caps at 100 percent and says the upgrade is ready", () => {
    const p = tierProgress("gold", 9);
    expect(p.percent).toBe(100);
    expect(p.remaining).toBe(0);
    expect(remainingText(0)).toBe("Upgrade ready!");
    expect(remainingText(1)).toBe("1 more referral");
    expect(remainingText(4)).toBe("4 more referrals");
  });

  it("the top tier is full and has no next tier", () => {
    const p = tierProgress("elite", 2);
    expect(p.next).toBeNull();
    expect(p.percent).toBe(100);
    expect(p.remaining).toBe(0);
  });

  it("not enrolled needs one referral; an unknown or missing tier reads as not enrolled", () => {
    expect(tierProgress("not_enrolled", 0)).toMatchObject({ percent: 0, remaining: 1 });
    expect(tierProgress(undefined, 0).info.label).toBe("Not Enrolled");
    expect(tierProgress("platinum", 0).info.label).toBe("Not Enrolled");
  });

  it("uses the thresholds 1, 3 and 5", () => {
    expect(tierProgress("not_enrolled", 0).info.nextAt).toBe(1);
    expect(tierProgress("standard", 0).info.nextAt).toBe(3);
    expect(tierProgress("gold", 0).info.nextAt).toBe(5);
  });

  it("pluralises the referral count", () => {
    expect(referralCountText(1)).toBe("1 referral");
    expect(referralCountText(0)).toBe("0 referrals");
  });
});

describe("referral balances", () => {
  const referrals = [
    ref({ id: "1", referralStatus: "IN_WALLET", payoutAmount: "25.00" }),
    ref({ id: "2", referralStatus: "IN_WALLET", payoutAmount: "10.50" }),
    ref({ id: "3", referralStatus: "PENDING", isDue: false, payoutAmount: "40.00" }),
    ref({ id: "4", referralStatus: "PENDING", isDue: true, payoutAmount: "99.00" }),
    ref({ id: "5", referralStatus: "PAID", payoutAmount: "30.00" }),
    ref({ id: "6", referralStatus: "VOIDED", payoutAmount: "500.00" }),
    ref({ id: "7", referralStatus: "PAID", payoutAmount: null }),
  ];

  it("adds up what is in the wallet, what is still pending (not yet due) and what was paid", () => {
    expect(availableFromReferrals(referrals)).toBe(35.5);
    expect(pendingFromReferrals(referrals)).toBe(40);
    expect(totalPaidText(referrals)).toBe("30.00");
  });

  it("counts voided referrals out of the tier count but not the wallet badge", () => {
    expect(activeReferrals(referrals)).toHaveLength(6);
    expect(inWalletCount(referrals)).toBe(2);
  });
});

describe("parseBalance / pendingWithdrawalTotal", () => {
  it("reads the server balance, 0 when missing or unreadable", () => {
    expect(parseBalance("12.30")).toBe(12.3);
    expect(parseBalance(undefined)).toBe(0);
    expect(parseBalance("abc")).toBe(0);
  });

  it("totals only pending withdrawals", () => {
    const w = (status: PortalWithdrawal["status"], amount: string): PortalWithdrawal => ({
      id: status + amount, referral_id: "r", amount, method: "bank_transfer", status, account_name: null, account_number: null,
      sort_code: null, transfer_reference: null, booking_id: null, credit_note: null, requested_at: "2026-01-01", processed_at: null,
    });
    expect(pendingWithdrawalTotal([w("pending", "10.00"), w("pending", "5.50"), w("processed", "99.00"), w("rejected", "1.00")])).toBe(15.5);
  });
});

describe("wallet history", () => {
  it("leaves out rejected records and puts the newest first (by processed date, else created date)", () => {
    const entries = walletEntries([
      tx({ id: "old", created_at: "2026-01-01T00:00:00Z" }),
      tx({ id: "rejected", status: "rejected", created_at: "2026-06-01T00:00:00Z" }),
      tx({ id: "new", created_at: "2026-02-01T00:00:00Z", processed_at: "2026-04-01T00:00:00Z" }),
    ]);
    expect(entries.map((e) => e.id)).toEqual(["new", "old"]);
  });

  const names = new Map([["r1", "Sam Friend"]]);
  const entry = (over: Partial<WalletEntry>): WalletEntry => ({
    id: "e", type: "credit", source: "referral_commission", amount: "12.5", status: "processed", date: null, referral_id: null, ...over,
  });

  it("words each kind of record and signs the amount", () => {
    expect(describeEntry(entry({ referral_id: "r1" }), names)).toEqual({ label: "Commission credited", subtitle: "Sam Friend", amount: "+£12.50", pending: false, credit: true });
    expect(describeEntry(entry({ type: "debit", source: "booking_credit" }), names)).toMatchObject({ label: "Booking credit applied", subtitle: "Applied to booking", amount: "−£12.50" });
    expect(describeEntry(entry({ type: "debit", source: "bank_transfer", status: "pending" }), names)).toMatchObject({ label: "Withdrawal requested", subtitle: "Bank transfer", pending: true });
    expect(describeEntry(entry({ type: "debit", source: "bank_transfer" }), names).label).toBe("Withdrawal processed");
  });

  it("counts processed commission credits", () => {
    expect(commissionCount([tx({}), tx({ status: "pending" }), tx({ type: "debit" }), tx({})])).toBe(2);
  });
});

describe("checkWithdrawal (the rules the form has always had)", () => {
  const bank = { method: "bank_transfer" as const, accountName: " A Customer ", accountNumber: " 12345678 ", sortCode: " 12-34-56 " };

  it("refuses when there is nothing to withdraw", () => {
    expect(checkWithdrawal(0, bank)).toEqual({ ok: false, error: "You have no available balance to withdraw." });
    expect(checkWithdrawal(-1, bank).ok).toBe(false);
  });

  it("asks for all three bank details for a bank transfer, each non-blank", () => {
    const message = "Please fill in all bank details before withdrawing.";
    expect(checkWithdrawal(10, { ...bank, accountName: "" })).toEqual({ ok: false, error: message });
    expect(checkWithdrawal(10, { ...bank, accountNumber: "   " })).toEqual({ ok: false, error: message });
    expect(checkWithdrawal(10, { ...bank, sortCode: "" })).toEqual({ ok: false, error: message });
  });

  it("sends the whole balance to two decimals with the bank details trimmed", () => {
    expect(checkWithdrawal(12.3, bank)).toEqual({
      ok: true,
      payload: { method: "bank_transfer", amount: "12.30", account_name: "A Customer", account_number: "12345678", sort_code: "12-34-56" },
    });
  });

  it("a booking credit needs no bank details and sends none", () => {
    expect(checkWithdrawal(5, { method: "booking_credit", accountName: "", accountNumber: "", sortCode: "" })).toEqual({
      ok: true,
      payload: { method: "booking_credit", amount: "5.00" },
    });
  });

  it("does not check the format of the account number or sort code (any text is sent)", () => {
    const r = checkWithdrawal(5, { method: "bank_transfer", accountName: "x", accountNumber: "abc", sortCode: "??" });
    expect(r.ok).toBe(true);
  });
});
