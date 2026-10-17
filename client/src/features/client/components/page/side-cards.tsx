import { Loader2, KeyRound, Send, ShieldCheck, ShieldUser, UserRound, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { cn } from "@/lib/utils";
import { useNeonClient } from "@/hooks/queries";
import { useVipOverview } from "@/features/referral/api/use-referral-queries";
import { usePortalPin } from "@/features/client/api/use-portal-pin";
import { currency } from "@/features/client/components/client-types";
import { CARD_CLASS, CardHead } from "./card-head";

// ─── Referred by ────────────────────────────────────────────────────────────

export function ReferredByCard({
  referrerId,
  readOnly,
  onChange,
}: {
  referrerId: string | null | undefined;
  readOnly: boolean;
  onChange: () => void;
}) {
  const { data: referrer, isLoading } = useNeonClient(referrerId ?? "");
  const name = referrer ? `${referrer.firstName} ${referrer.surename}`.trim() : "";

  return (
    <section className={CARD_CLASS} data-testid="client-index-referrer">
      <CardHead title="Referred by" icon={ShieldUser} />
      {referrerId && isLoading ? (
        <div className="flex animate-pulse items-center gap-3" data-testid="referrer-loading">
          <span className="h-[38px] w-[38px] rounded-full bg-muted" />
          <span className="h-4 w-32 rounded bg-muted" />
        </div>
      ) : referrerId && referrer ? (
        <div className="flex items-center gap-3" data-testid="referrer-field">
          <PersonAvatar name={name} size={38} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name}</div>
            {referrer.phoneNumber && <div className="truncate text-xs text-social-muted">{referrer.phoneNumber}</div>}
          </div>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={onChange} data-testid="button-change-referrer">
              Change
            </Button>
          )}
        </div>
      ) : readOnly ? (
        <p className="text-sm text-social-muted">No referrer.</p>
      ) : (
        <button
          type="button"
          onClick={onChange}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-ticket-dashed text-sm font-medium text-social-muted transition hover:text-foreground"
          data-testid="button-set-referrer"
        >
          <UserRound className="h-4 w-4" strokeWidth={1.8} /> Set referrer
        </button>
      )}
    </section>
  );
}

// ─── Portal access ──────────────────────────────────────────────────────────

export function PortalAccessCard({ clientId, readOnly, onChangePin }: { clientId: string; readOnly: boolean; onChangePin: () => void }) {
  const { hasPin, loading, sending, sendLink } = usePortalPin(clientId);

  return (
    <section className={CARD_CLASS} data-testid="card-portal-pin">
      <CardHead
        title="Portal access"
        icon={UserRound}
        right={
          loading ? undefined : hasPin ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-status-scheduled-fg" data-testid="badge-pin-active">
              <ShieldCheck className="h-4 w-4" /> PIN active
            </span>
          ) : (
            <span className="whitespace-nowrap text-[13px] font-semibold text-ticket-amber-fg">No PIN</span>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-social-muted">PIN</span>
        <div
          className="flex h-10 min-w-[70px] flex-1 items-center justify-center rounded-[10px] border border-social-border text-lg tracking-[6px] text-social-muted"
          data-testid="portal-pin-masked"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasPin ? "••••" : "—"}
        </div>
        {!readOnly && hasPin && (
          <Button type="button" variant="outline" className="h-10 gap-1.5 rounded-[10px]" disabled={sending} onClick={sendLink} data-testid="button-send-portal-link">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={1.8} />}
            Send link
          </Button>
        )}
        {!readOnly && !loading && (
          <Button type="button" variant="outline" className="h-10 gap-1.5 rounded-[10px]" onClick={onChangePin} data-testid="button-change-pin">
            <KeyRound className="h-4 w-4" strokeWidth={1.8} />
            {hasPin ? "Change" : "Set PIN"}
          </Button>
        )}
      </div>
    </section>
  );
}

// ─── Referral network ───────────────────────────────────────────────────────

function Tile({ label, value, sub, green, testId }: { label: string; value: string; sub: string; green?: boolean; testId: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border p-3.5",
        green ? "border-status-scheduled-fg/30 bg-status-scheduled-bg" : "border-social-border bg-card",
      )}
      data-testid={testId}
    >
      <div className="text-xs font-medium text-social-muted">{label}</div>
      <div className={cn("mb-0.5 mt-1.5 truncate text-2xl font-semibold", green && "text-status-scheduled-fg")}>{value}</div>
      <div className="text-[11px] text-social-muted">{sub}</div>
    </div>
  );
}

export function ReferralNetworkCard({ clientId }: { clientId: string }) {
  const { data, isLoading } = useVipOverview(clientId);
  const stats = data?.stats;

  return (
    <section className={CARD_CLASS} data-testid="referral-network-card">
      <CardHead title="Referral network" icon={Users} />
      <div className="rounded-[14px] border border-social-border p-4" data-testid="referral-stats-section">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Wallet className="h-[18px] w-[18px] text-status-posted-fg" strokeWidth={1.8} /> Referral account
        </div>
        <div className={cn("grid grid-cols-2 gap-2.5", isLoading && "animate-pulse")}>
          <Tile label="Referrals" value={String(stats?.total ?? 0)} sub="Total clients" testId="stat-total-referred" />
          <Tile label="Pending" value={currency.format(stats?.pendingPayout ?? 0)} sub="Awaiting" testId="stat-pending-commission" />
          <Tile label="Wallet" value={currency.format(stats?.availableBalance ?? 0)} sub="Available" green testId="stat-wallet-balance" />
          <Tile label="Overall" value={currency.format(stats?.overallPayout ?? 0)} sub="All-time" testId="stat-overall-commission" />
        </div>
      </div>
    </section>
  );
}
