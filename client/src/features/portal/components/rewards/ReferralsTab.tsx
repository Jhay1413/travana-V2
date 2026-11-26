import { useState } from "react";
import type { PortalReferral, PortalVipStatus } from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import {
  availableFromReferrals,
  formatCurrency,
  formatDate,
  pendingFromReferrals,
  poundsText,
  referralCountText,
  remainingText,
  statusLabel,
  tierProgress,
} from "../../lib/rewards";
import { toRoman } from "../../lib/quote-format";
import { QuietEmpty, SectionHead } from "./RewardsParts";

const HOW_IT_WORKS = [
  "Tell a friend to mention your name when booking",
  "Your referral is logged and tracked",
  "8 weeks before their trip, your reward is automatically added to your wallet",
  "Request a withdrawal — bank transfer or booking credit",
];

/** Rewards → Referrals: the tier and its progress, the earnings, how it works and the list of referrals. */
export function ReferralsTab({
  vip,
  referrals,
  active,
  totalPaid,
}: {
  vip: PortalVipStatus;
  referrals: PortalReferral[];
  /** Referrals that count (not voided). */
  active: PortalReferral[];
  /** Lifetime paid out, as the two-decimal string. */
  totalPaid: string;
}) {
  return (
    <div className="flex flex-col gap-14" data-testid="rewards-referrals">
      <TierSection tier={vip.vipTier} referralCount={active.length} />
      <EarningsSection referrals={referrals} totalPaid={totalPaid} />
      <section aria-labelledby="rewards-how">
        <SectionHead id="rewards-how" eyebrow="How it works" lead="Four simple" italic="steps." />
        <ol className="mt-6 border-b border-border">
          {HOW_IT_WORKS.map((text, i) => (
            <li key={text} className="flex gap-4 border-t border-border py-4">
              <span className="portal-serif w-8 flex-none text-[22px] leading-tight portal-text-amber-ink" aria-hidden>
                {toRoman(i + 1)}
              </span>
              <span className="min-w-0 text-[15px] leading-relaxed text-foreground [overflow-wrap:anywhere]">{text}</span>
            </li>
          ))}
        </ol>
      </section>
      <ReferralsSection active={active} />
    </div>
  );
}

function TierSection({ tier, referralCount }: { tier: string | null | undefined; referralCount: number }) {
  const { info, next, percent, remaining } = tierProgress(tier, referralCount);
  return (
    <section aria-labelledby="rewards-tier" data-testid="rewards-tier">
      <p className="portal-eyebrow">Your tier</p>
      <h2 id="rewards-tier" className="portal-serif mt-2 text-[40px] font-light leading-[1.08] text-primary [overflow-wrap:anywhere]" data-testid="text-tier-label">
        {info.label}
      </h2>
      <p className="mt-1 text-[15px] text-muted-foreground" data-testid="text-tier-perks">
        {info.perks}
      </p>
      <p className="portal-caps-label mt-3" data-testid="text-tier-referrals">
        {referralCountText(referralCount)}
      </p>

      {next ? (
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="text-muted-foreground">Progress to {next.label}</span>
            <span className="font-medium text-primary" data-testid="text-tier-remaining">
              {remainingText(remaining)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`Progress to ${next.label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            className="mt-2 h-2 w-full bg-secondary"
            data-testid="tier-progress"
          >
            <div className="h-full bg-primary motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span>{info.label}</span>
            <span className="text-right">{next.label}</span>
          </div>
        </div>
      ) : (
        <p className="portal-serif mt-6 text-[22px] italic portal-text-amber-ink" data-testid="text-tier-top">
          You&apos;ve reached the top tier!
        </p>
      )}
    </section>
  );
}

function EarningsSection({ referrals, totalPaid }: { referrals: PortalReferral[]; totalPaid: string }) {
  const rows = [
    { label: "Available", note: "Ready to redeem", value: poundsText(availableFromReferrals(referrals)), id: "available" },
    { label: "Pending", note: "Awaiting travel", value: poundsText(pendingFromReferrals(referrals)), id: "pending" },
    { label: "Total paid", note: "Lifetime earnings", value: poundsText(parseFloat(totalPaid || "0")), id: "total-paid" },
  ];
  return (
    <section aria-labelledby="rewards-earnings">
      <SectionHead id="rewards-earnings" eyebrow="Your earnings" lead="What you've" italic="earned." />
      <dl className="mt-6 border-b border-border" data-testid="rewards-earnings">
        {rows.map((r) => (
          <div key={r.id} className="flex items-baseline justify-between gap-4 border-t border-border py-4">
            <div className="min-w-0">
              <dt className="portal-caps-label">{r.label}</dt>
              <p className="text-[15px] text-muted-foreground">{r.note}</p>
            </div>
            <dd className="portal-serif text-[30px] leading-none portal-text-ink" data-testid={`earnings-${r.id}`}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReferralsSection({ active }: { active: PortalReferral[] }) {
  return (
    <section aria-labelledby="rewards-list">
      <SectionHead
        id="rewards-list"
        eyebrow="Your referrals"
        lead="Friends you've"
        italic="referred."
        aside={active.length > 0 ? <span className="portal-caps-label" data-testid="text-referrals-total">{active.length} total</span> : undefined}
      />
      <div className="mt-6">
        {active.length === 0 ? (
          <QuietEmpty title="No referrals yet" testId="referrals-empty">
            When your agent logs a referral for you, it will appear here.
          </QuietEmpty>
        ) : (
          <ul className="border-b border-border" data-testid="referrals-list">
            {active.map((r) => (
              <ReferralRow key={r.id} referral={r} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const PROGRESS_STEPS: { key: PortalReferral["referralStatus"]; label: string }[] = [
  { key: "PENDING", label: "Logged" },
  { key: "IN_WALLET", label: "In Wallet" },
  { key: "PAID", label: "Paid Out" },
];

/** Logged, In wallet, Paid out: the steps reached are filled, the current one is marked. */
function ReferralSteps({ status }: { status: PortalReferral["referralStatus"] }) {
  const activeIdx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="grid grid-cols-3 gap-2 py-3" aria-label="Referral progress">
      {PROGRESS_STEPS.map((step, i) => {
        const done = i < activeIdx;
        const current = i === activeIdx;
        return (
          <li key={step.key} className="flex flex-col gap-1.5" aria-current={current ? "step" : undefined}>
            <span className={cn("h-1 w-full", done || current ? "bg-primary" : "bg-secondary")} aria-hidden />
            <span className={cn("text-[11px] uppercase tracking-[0.14em]", current ? "font-medium text-primary" : done ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
              <span className="sr-only">{done ? " (done)" : current ? " (now)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ReferralRow({ referral }: { referral: PortalReferral }) {
  const [expanded, setExpanded] = useState(false);
  const due = referral.isDue && referral.referralStatus === "PENDING";
  const detailId = `referral-detail-${referral.id}`;
  const details: { label: string; value: string; tone?: "paid" }[] = [];
  if (referral.referredEmail) details.push({ label: "Email", value: referral.referredEmail });
  if (referral.travelDate) details.push({ label: "Travel date", value: formatDate(referral.travelDate) });
  if (referral.commissionRate) details.push({ label: "Commission rate", value: `${referral.commissionRate}%` });
  if (referral.payoutTriggerDate) details.push({ label: "Payout due", value: formatDate(referral.payoutTriggerDate) });
  if (referral.paidAt) details.push({ label: "Paid on", value: formatDate(referral.paidAt), tone: "paid" });
  details.push({ label: "Referred on", value: formatDate(referral.createdAt) });

  return (
    <li className="border-t border-border" data-testid={`referral-${referral.id}`}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[64px] w-full items-center justify-between gap-4 py-4 text-left"
        data-testid={`button-referral-${referral.id}`}
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className="portal-serif text-[22px] leading-tight text-primary [overflow-wrap:anywhere]">{referral.referredName}</span>
          <span className="flex flex-wrap items-center gap-x-3 text-[11px] uppercase tracking-[0.18em]">
            <span className={cn(referral.referralStatus === "IN_WALLET" ? "portal-text-amber-ink" : "text-muted-foreground")} data-testid={`referral-status-${referral.id}`}>
              {statusLabel(referral.referralStatus)}
            </span>
            {due && (
              <span className="portal-text-amber-ink" data-testid={`referral-due-${referral.id}`}>
                Due
              </span>
            )}
          </span>
        </span>
        <span className="flex flex-none items-center gap-3">
          {referral.payoutAmount && referral.referralStatus !== "VOIDED" && (
            <span className="portal-serif text-[22px] portal-text-ink" data-testid={`referral-amount-${referral.id}`}>
              {formatCurrency(referral.payoutAmount)}
            </span>
          )}
          <span aria-hidden className={cn("text-[18px] text-muted-foreground transition-transform", expanded && "rotate-180")}>
            ⌄
          </span>
        </span>
      </button>
      {expanded && (
        <div id={detailId} className="pb-5">
          {referral.referralStatus !== "VOIDED" && <ReferralSteps status={referral.referralStatus} />}
          <dl>
            {details.map((d) => (
              <div key={d.label} className="flex justify-between gap-4 py-1.5 text-[15px]">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className={cn("min-w-0 text-right [overflow-wrap:anywhere]", d.tone === "paid" ? "portal-text-amber-ink" : "text-foreground")}>{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </li>
  );
}
