import { useState } from "react";
import { useRequestWalletWithdraw, type PortalWalletTransaction } from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import { checkWithdrawal, commissionCount, methodLabel, poundsText, type WithdrawMethod } from "../../lib/rewards";
import { PortalButton } from "../brand";
import { PortalField } from "../PortalField";
import { PortalSheet } from "../PortalSheet";

/**
 * Booking credit is not offered yet. The server requires bank details for every withdrawal and records each one as a
 * bank transfer, so a booking-credit request always fails. Turn this on only once the owner has decided what booking
 * credit should do and the server supports it.
 */
export const BOOKING_CREDIT_WITHDRAWAL_ENABLED = false;

const ALL_METHODS: { value: WithdrawMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "booking_credit", label: "Booking credit" },
];

/** The methods the customer can choose from; with only one there is no picker. */
export const METHODS = ALL_METHODS.filter((m) => m.value !== "booking_credit" || BOOKING_CREDIT_WITHDRAWAL_ENABLED);

interface Requested {
  amount: number;
  method: WithdrawMethod;
}

/**
 * Withdraw the whole available balance, by bank transfer or booking credit (the agent then processes it).
 * The form's rules and the request it sends are in lib/rewards (checkWithdrawal). It is mounted only while open,
 * so each opening starts empty. Not a <form>: Enter in a field never sends money.
 */
export function WithdrawSheet({
  transactions,
  balance,
  onClose,
}: {
  transactions: PortalWalletTransaction[];
  /** The server's wallet balance. */
  balance: number;
  onClose: () => void;
}) {
  const withdraw = useRequestWalletWithdraw();
  const [method, setMethod] = useState<WithdrawMethod>("bank_transfer");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  // What was asked for, kept so the confirmation is right even after the balance refreshes to zero.
  const [requested, setRequested] = useState<Requested | null>(null);

  const credits = commissionCount(transactions);

  async function handleWithdraw() {
    setValidationError(null);
    const check = checkWithdrawal(balance, { method, accountName, accountNumber, sortCode });
    if (!check.ok) {
      setValidationError(check.error);
      return;
    }
    try {
      await withdraw.mutateAsync(check.payload);
      setRequested({ amount: balance, method });
    } catch {
      // The message surfaces through withdraw.error below.
    }
  }

  const errorText = validationError ?? (withdraw.isError ? (withdraw.error?.message || "Something went wrong. Please try again.") : null);

  return (
    <PortalSheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      label="Your wallet"
      lead="Withdraw"
      italic="funds."
      description={`${credits} commission${credits !== 1 ? "s" : ""} in wallet`}
      testId="sheet-withdraw"
    >
      {requested ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center" role="status" data-testid="withdraw-done">
          <p className="portal-eyebrow">Withdrawal requested</p>
          <p className="portal-serif text-[56px] font-light leading-none portal-text-ink" data-testid="withdraw-done-amount">
            {poundsText(requested.amount)}
          </p>
          <p className="text-[15px] text-foreground" data-testid="withdraw-done-method">
            {methodLabel(requested.method)}
          </p>
          <p className="mt-2 text-[15px] text-muted-foreground">Your agent will process your payment shortly.</p>
          <PortalButton variant="outline" className="mt-6 w-full" onClick={onClose} data-testid="button-withdraw-close">
            Close
          </PortalButton>
        </div>
      ) : balance <= 0 ? (
        <div className="py-6 text-center" data-testid="withdraw-empty">
          <p className="portal-serif text-[26px] text-primary">Wallet is empty</p>
          <p className="mt-2 text-[15px] text-muted-foreground">Commissions are released automatically 8 weeks before your friend&apos;s travel date</p>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          <div className="border-y border-border py-5 text-center">
            <p className="portal-serif text-[52px] font-light leading-none portal-text-ink" data-testid="withdraw-amount">
              {poundsText(balance)}
            </p>
            <p className="portal-caps-label mt-2">Available to withdraw</p>
          </div>

          {METHODS.length > 1 && (
          <div role="radiogroup" aria-label="How would you like it?" className="flex flex-col gap-3">
            <p className="portal-caps-label">How would you like it?</p>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => {
                const on = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setMethod(m.value)}
                    className={cn(
                      "min-h-12 border px-3 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-transparent text-primary hover:bg-secondary",
                    )}
                    data-testid={`button-method-${m.value}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {method === "bank_transfer" && (
            <div className="flex flex-col gap-5" data-testid="withdraw-bank-details">
              <p className="portal-caps-label">Your bank details</p>
              <PortalField id="withdraw-account-name" label="Account holder name" type="text" value={accountName} onChange={(e) => setAccountName(e.target.value)} autoComplete="off" data-testid="input-account-name" />
              <PortalField id="withdraw-account-number" label="Account number" type="text" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} autoComplete="off" data-testid="input-account-number" />
              <PortalField id="withdraw-sort-code" label="Sort code (e.g. 12-34-56)" type="text" value={sortCode} onChange={(e) => setSortCode(e.target.value)} autoComplete="off" data-testid="input-sort-code" />
              <p className="text-[15px] text-muted-foreground">Your agent will transfer directly to this account.</p>
            </div>
          )}

          {errorText && (
            <p role="alert" className="portal-text-danger border border-current px-4 py-3 text-center text-[15px]" data-testid="withdraw-error">
              {errorText}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <PortalButton className="w-full" onClick={handleWithdraw} disabled={withdraw.isPending} data-testid="button-withdraw-submit">
              {withdraw.isPending ? "Requesting…" : `Withdraw ${poundsText(balance)}`}
            </PortalButton>
            <p className="text-center text-[15px] text-muted-foreground">Your agent will process your payment after confirming your details.</p>
          </div>
        </div>
      )}
    </PortalSheet>
  );
}
