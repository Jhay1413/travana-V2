import { useState } from "react";
import {
  usePortalReferrals,
  usePortalVipStatus,
  usePortalWalletBalance,
  usePortalWalletTransactions,
  usePortalWithdrawals,
  type PortalVipStatus,
} from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import { activeReferrals, inWalletCount, parseBalance, totalPaidText } from "../../lib/rewards";
import { Eyebrow, PortalHero, PortalSection } from "../brand";
import { ReferralsTab } from "./ReferralsTab";
import { WalletTab } from "./WalletTab";
import { WithdrawSheet } from "./WithdrawSheet";

const DEFAULT_VIP: PortalVipStatus = {
  vipTier: "not_enrolled",
  vipEnrolledAt: null,
  totalReferrals: 0,
  walletBalance: "0.00",
};

type PageTab = "referrals" | "wallet";

const TAB = "min-h-12 flex-1 border-b-2 px-2 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors";

/** Rewards: refer friends, earn commission. Tier progress and referrals on one tab, the wallet and withdrawals on the other. */
export function RewardsView() {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [tab, setTab] = useState<PageTab>("referrals");

  const { data: vip, isLoading: vipLoading } = usePortalVipStatus();
  const { data: referrals = [], isLoading: referralsLoading } = usePortalReferrals();
  const { data: withdrawals = [], isLoading: withdrawalsLoading } = usePortalWithdrawals();
  const { data: walletTransactions = [] } = usePortalWalletTransactions();
  const { data: walletBalanceStr } = usePortalWalletBalance();
  const trueBalance = parseBalance(walletBalanceStr);

  const loading = vipLoading || referralsLoading || withdrawalsLoading;
  const active = activeReferrals(referrals);
  const availableCount = inWalletCount(referrals);
  const totalPaid = totalPaidText(referrals);

  return (
    <div data-testid="portal-rewards">
      <PortalHero className="min-h-[210px]">
        <Eyebrow className="portal-text-amber-soft">Rewards</Eyebrow>
        <h1 className="portal-serif text-[44px] font-light leading-none text-white" data-testid="text-rewards-title">
          Your
          <br />
          <em className="italic">rewards.</em>
        </h1>
        <p className="max-w-[300px] text-[15px] leading-[1.6] text-white/85">Refer friends · Earn commission</p>
      </PortalHero>

      <PortalSection className="pb-14 pt-4">
        <div role="tablist" aria-label="Rewards" className="flex border-b border-border" data-testid="tabs-rewards">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "referrals"}
            onClick={() => setTab("referrals")}
            className={cn(TAB, tab === "referrals" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary")}
            data-testid="tab-rewards-referrals"
          >
            Referrals
            {active.length > 0 && (
              <span className="ml-2 inline-block min-w-[20px] bg-secondary px-1.5 text-center text-[11px] leading-5 text-primary" data-testid="count-rewards-referrals">
                {active.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "wallet"}
            onClick={() => setTab("wallet")}
            className={cn(TAB, tab === "wallet" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary")}
            data-testid="tab-rewards-wallet"
          >
            Wallet
            {availableCount > 0 && (
              <span className="ml-2 inline-block min-w-[20px] bg-accent px-1.5 text-center text-[11px] leading-5 text-accent-foreground" data-testid="count-rewards-wallet">
                {availableCount}
              </span>
            )}
          </button>
        </div>

        <div className="pt-10">
          {loading ? (
            <RewardsLoading />
          ) : tab === "referrals" ? (
            <ReferralsTab vip={vip ?? DEFAULT_VIP} referrals={referrals} active={active} totalPaid={totalPaid} />
          ) : (
            <WalletTab
              referrals={referrals}
              withdrawals={withdrawals}
              transactions={walletTransactions}
              totalPaid={totalPaid}
              balance={trueBalance}
              onWithdraw={() => setShowWithdraw(true)}
            />
          )}
        </div>
      </PortalSection>

      {showWithdraw && <WithdrawSheet transactions={walletTransactions} balance={trueBalance} onClose={() => setShowWithdraw(false)} />}
    </div>
  );
}

function RewardsLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" role="status" aria-label="Loading your rewards" data-testid="rewards-loading">
      <div className="h-10 w-2/3 bg-secondary" />
      <div className="h-2 w-full bg-secondary" />
      <div className="h-16 w-full bg-secondary" />
      <div className="h-16 w-full bg-secondary" />
      <div className="h-16 w-full bg-secondary" />
    </div>
  );
}
