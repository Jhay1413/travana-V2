import type { PortalReferral, PortalWalletTransaction, PortalWithdrawal } from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import {
  describeEntry,
  formatDate,
  methodLabel,
  pendingFromReferrals,
  pendingWithdrawalTotal,
  poundsText,
  walletEntries,
} from "../../lib/rewards";
import { PortalButton } from "../brand";
import { QuietEmpty, SectionHead } from "./RewardsParts";

/** Rewards → Wallet: the balance, any withdrawal waiting for the agent, the Withdraw button and the history. */
export function WalletTab({
  referrals,
  withdrawals,
  transactions,
  totalPaid,
  balance,
  onWithdraw,
}: {
  referrals: PortalReferral[];
  withdrawals: PortalWithdrawal[];
  transactions: PortalWalletTransaction[];
  /** Lifetime paid out, as the two-decimal string. */
  totalPaid: string;
  /** The server's wallet balance: what can be withdrawn. */
  balance: number;
  onWithdraw: () => void;
}) {
  const pendingBalance = pendingFromReferrals(referrals);
  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const pendingWithdrawalBalance = pendingWithdrawalTotal(withdrawals);
  const referralNames = new Map(referrals.map((r) => [r.id, r.referredName]));
  const entries = walletEntries(transactions);

  return (
    <div className="flex flex-col gap-12" data-testid="rewards-wallet">
      <section aria-labelledby="wallet-balance-label" className="border-b border-border pb-8">
        <p id="wallet-balance-label" className="portal-eyebrow">
          Available balance
        </p>
        <p className="portal-serif mt-2 text-[64px] font-light leading-none portal-text-ink" data-testid="wallet-balance">
          {poundsText(balance)}
        </p>
        <p className="mt-2 text-[15px] text-muted-foreground" data-testid="wallet-balance-note">
          {balance > 0 ? `${poundsText(balance)} available to withdraw` : "No available balance"}
        </p>

        <dl className="mt-6 border-b border-border">
          <div className="flex items-baseline justify-between gap-4 border-t border-border py-3.5">
            <div>
              <dt className="portal-caps-label">Unreleased</dt>
              <p className="text-[15px] text-muted-foreground">Not yet due</p>
            </div>
            <dd className="portal-serif text-[26px] leading-none portal-text-ink" data-testid="wallet-unreleased">
              {poundsText(pendingBalance)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-border py-3.5">
            <div>
              <dt className="portal-caps-label">Total paid out</dt>
              <p className="text-[15px] text-muted-foreground">Lifetime earnings</p>
            </div>
            <dd className="portal-serif text-[26px] leading-none portal-text-ink" data-testid="wallet-total-paid">
              {poundsText(parseFloat(totalPaid || "0"))}
            </dd>
          </div>
        </dl>

        {pendingWithdrawalBalance > 0 && (
          <div className="mt-6 border border-border bg-secondary px-4 py-4" role="status" data-testid="wallet-withdrawal-pending">
            <p className="portal-eyebrow">Withdrawal pending</p>
            <div className="mt-1 flex items-baseline justify-between gap-4">
              <p className="min-w-0 text-[15px] text-foreground [overflow-wrap:anywhere]">
                {methodLabel(pendingWithdrawals[0]?.method)} · Awaiting agent approval
              </p>
              <p className="portal-serif flex-none text-[26px] leading-none portal-text-ink" data-testid="wallet-withdrawal-pending-amount">
                {poundsText(pendingWithdrawalBalance)}
              </p>
            </div>
          </div>
        )}

        {balance > 0 && (
          <PortalButton className="mt-6 w-full" onClick={onWithdraw} data-testid="button-open-withdraw">
            Withdraw · {poundsText(balance)}
          </PortalButton>
        )}
      </section>

      <section aria-labelledby="wallet-history">
        <SectionHead id="wallet-history" eyebrow="Transaction history" lead="Every" italic="movement." />
        <div className="mt-6">
          {entries.length === 0 ? (
            <QuietEmpty title="No wallet activity yet" testId="wallet-empty">
              Commissions appear here once your referrals are released (8 weeks before travel).
            </QuietEmpty>
          ) : (
            <ul className="border-b border-border" data-testid="wallet-transactions">
              {entries.map((entry) => {
                const t = describeEntry(entry, referralNames);
                return (
                  <li key={entry.id} className="flex items-start justify-between gap-4 border-t border-border py-4" data-testid={`wallet-entry-${entry.id}`}>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-3 text-[15px] text-foreground [overflow-wrap:anywhere]">
                        {t.label}
                        {t.pending && (
                          <span className="text-[11px] font-normal uppercase tracking-[0.18em] portal-text-amber-ink" data-testid={`wallet-entry-pending-${entry.id}`}>
                            Pending
                          </span>
                        )}
                      </p>
                      {t.subtitle && <p className="text-[15px] text-muted-foreground [overflow-wrap:anywhere]">{t.subtitle}</p>}
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{formatDate(entry.date)}</p>
                    </div>
                    <p className={cn("portal-serif flex-none text-[24px] leading-tight", t.credit ? "portal-text-amber-ink" : "portal-text-ink")} data-testid={`wallet-entry-amount-${entry.id}`}>
                      {t.amount}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
