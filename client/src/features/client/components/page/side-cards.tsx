import { useState } from "react";
import { Loader2, KeyRound, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVipOverview } from "@/features/referral/api/use-referral-queries";
import { usePortalPin } from "@/features/client/api/use-portal-pin";
import { SendByChoice, WhatsappFallbackPanel, canSendBy, effectiveChannel, heldFor, hold, useSendAvailability, type Held, type SendChannel } from "@/features/customer-messaging";
import { currency } from "@/features/client/components/client-types";

// ─── Portal access ──────────────────────────────────────────────────────────

export function PortalAccessPanel({ clientId, readOnly, onChangePin, clientPhone }: { clientId: string; readOnly: boolean; onChangePin: () => void; clientPhone?: string | null }) {
  const { hasPin, loading, sending, sendLink, fallback, clearFallback } = usePortalPin(clientId);
  const availabilityQuery = useSendAvailability(clientId, "portal_sign_in", !readOnly);
  // The pick belongs to this client: another client's page starts from the agency's channel again.
  const [pickedHeld, setPickedHeld] = useState<Held<SendChannel> | null>(null);
  const channel = effectiveChannel(heldFor(pickedHeld, clientId), availabilityQuery.data);
  const canSend = canSendBy(channel, availabilityQuery.data);

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
          {!readOnly && !loading && (
            <Button type="button" variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]" onClick={onChangePin} data-testid="button-change-pin">
              <KeyRound className="h-3.5 w-3.5" strokeWidth={1.8} />
              {hasPin ? "Change" : "Set PIN"}
            </Button>
          )}
        </div>
        {!readOnly && (
          <div className="flex w-full flex-wrap items-start justify-between gap-2 border-t border-social-border pt-2.5" data-testid="portal-send-link-row">
            <SendByChoice availability={availabilityQuery.data} loading={availabilityQuery.isLoading} value={channel} onChange={(c) => { clearFallback(); setPickedHeld(hold(clientId, c)); }} disabled={sending} testId="portal-send-by" />
            <Button type="button" variant="outline" className="h-8 gap-1.5 rounded-lg px-2.5 text-[12px]" disabled={sending || !canSend} onClick={() => sendLink(channel)} data-testid="button-send-portal-link">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={1.8} />}
              Send link
            </Button>
            {fallback && (
              <div className="w-full">
                <WhatsappFallbackPanel fallback={fallback} phone={clientPhone} testId="portal-whatsapp-fallback" />
              </div>
            )}
          </div>
        )}
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
