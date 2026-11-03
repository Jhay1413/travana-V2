import { Loader2, KeyRound, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVipOverview } from "@/features/referral/api/use-referral-queries";
import { usePortalPin } from "@/features/client/api/use-portal-pin";
import { currency } from "@/features/client/components/client-types";

// ─── Portal access ──────────────────────────────────────────────────────────

export function PortalAccessPanel({ clientId, readOnly, onChangePin }: { clientId: string; readOnly: boolean; onChangePin: () => void }) {
  const { hasPin, loading, sending, sendLink } = usePortalPin(clientId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid="card-portal-pin">
        <div className="flex min-w-0 items-center gap-2">
          {hasPin ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-status-scheduled-fg" strokeWidth={1.8} />
          ) : (
            <KeyRound className="h-4 w-4 shrink-0 text-ticket-amber-fg" strokeWidth={1.8} />
          )}
          {!loading && (
            <span
              className={cn("whitespace-nowrap text-[13px] font-semibold", hasPin ? "text-status-scheduled-fg" : "text-ticket-amber-fg")}
              data-testid={hasPin ? "badge-pin-active" : undefined}
            >
              {hasPin ? "Portal PIN active" : "No portal PIN"}
            </span>
          )}
          <span
            className="inline-flex min-w-[40px] items-center justify-center rounded-md border border-social-border px-2 py-0.5 font-mono text-[12px] tracking-[3px] text-social-muted"
            data-testid="portal-pin-masked"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : hasPin ? "••••" : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!readOnly && hasPin && (
            <Button type="button" variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]" disabled={sending} onClick={sendLink} data-testid="button-send-portal-link">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={1.8} />}
              Send link
            </Button>
          )}
          {!readOnly && !loading && (
            <Button type="button" variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]" onClick={onChangePin} data-testid="button-change-pin">
              <KeyRound className="h-3.5 w-3.5" strokeWidth={1.8} />
              {hasPin ? "Change" : "Set PIN"}
            </Button>
          )}
        </div>
    </div>
  );
}

// ─── Referral network ───────────────────────────────────────────────────────

function Tile({ label, value, green, testId }: { label: string; value: string; green?: boolean; testId: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border p-2.5",
        green ? "border-status-scheduled-fg/30 bg-status-scheduled-bg" : "border-social-border bg-card",
      )}
      data-testid={testId}
    >
      <div className="truncate text-[11px] font-medium text-social-muted">{label}</div>
      <div className={cn("mt-0.5 truncate text-[15px] font-semibold", green && "text-status-scheduled-fg")}>{value}</div>
    </div>
  );
}

export function ReferralNetworkPanel({ clientId }: { clientId: string }) {
  const { data, isLoading } = useVipOverview(clientId);
  const stats = data?.stats;

  return (
    <div className={cn("grid grid-cols-2 gap-2 min-[400px]:grid-cols-4", isLoading && "animate-pulse")} data-testid="referral-stats-section">
      <Tile label="Referrals" value={String(stats?.total ?? 0)} testId="stat-total-referred" />
      <Tile label="Pending" value={currency.format(stats?.pendingPayout ?? 0)} testId="stat-pending-commission" />
      <Tile label="Wallet" value={currency.format(stats?.availableBalance ?? 0)} green testId="stat-wallet-balance" />
      <Tile label="Overall" value={currency.format(stats?.overallPayout ?? 0)} testId="stat-overall-commission" />
    </div>
  );
}
