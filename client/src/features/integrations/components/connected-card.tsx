import { useState } from "react";
import { Loader2, Unplug } from "lucide-react";
import type { SsChannel } from "@/features/conversations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { CARD } from "./classes";
import { channelStatus, channelSubtitle } from "../lib/channel-status";
import type { ChannelHealth } from "../types";
import { ChannelIcon } from "./channel-icon";

interface ConnectedCardProps {
  channels: SsChannel[] | undefined;
  health: ChannelHealth | undefined;
  loading: boolean;
  canWrite: boolean;
  removingId: string | null;
  onDisconnect: (channel: SsChannel) => void;
}

function Avatar({ channel }: { channel: SsChannel }) {
  if (channel.avatar_url) {
    return <img src={channel.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return <ChannelIcon type={channel.channel_type} />;
}

/** The org's channels, their status, and the disconnect action. */
export function ConnectedCard({ channels, health, loading, canWrite, removingId, onDisconnect }: ConnectedCardProps) {
  const [confirm, setConfirm] = useState<SsChannel | null>(null);
  const list = channels ?? [];
  const nameOf = (c: SsChannel) => c.name || c.channel_type;

  return (
    <section className={CARD} aria-labelledby="int-connected-h" data-testid="integrations-connected-card">
      <h2 className="text-[15px] font-semibold xl:text-base" id="int-connected-h">
        Connected channels
      </h2>
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[13px] text-social-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading channels…
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-10 text-center text-[13px] text-social-muted" data-testid="integrations-empty">
          <b className="text-[14px] font-semibold text-foreground">No channels connected yet</b>
          <span>Connect one below and its messages will start arriving in the inbox.</span>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-social-border">
          {list.map((c) => {
            const status = channelStatus(c, health);
            return (
              <li key={c.id} className="flex min-w-0 items-center gap-3 py-3" data-testid={`channel-row-${c.id}`}>
                <Avatar channel={c} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">{nameOf(c)}</div>
                  <div className="truncate text-[12px] text-social-muted xl:text-[13px]">{channelSubtitle(c)}</div>
                </div>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                {canWrite && (
                  <Button
                    type="button"
                    variant="outline"
                    className={OUTLINE_ACTION}
                    disabled={removingId === c.id}
                    aria-label={`Disconnect ${nameOf(c)}`}
                    onClick={() => setConfirm(c)}
                    data-testid={`button-disconnect-${c.id}`}
                  >
                    {removingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Unplug className="h-4 w-4" aria-hidden />}
                    Disconnect
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {confirm ? nameOf(confirm) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Disconnect {confirm ? nameOf(confirm) : ""}? Messages from this channel will stop arriving in the inbox. You can reconnect it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-disconnect"
              onClick={() => {
                if (confirm) onDisconnect(confirm);
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
