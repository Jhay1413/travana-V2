import { Loader2, Mail, Plus, RefreshCw, Unplug } from "lucide-react";
import type { SsChannel } from "@/features/conversations";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/shared/status-pill";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { channelLabel, channelStatus, channelSubtitle } from "../lib/channel-status";
import { groupStatus, type ChannelGroup } from "../lib/channel-groups";
import type { ChannelHealth } from "../types";
import { ChannelIcon } from "./channel-icon";
import { CARD_OUTLINE, CARD_PRIMARY, ICON_ACTION, TEXT_ACTION } from "./classes";

const DESCRIPTIONS: Record<string, string> = {
  whatsapp: "Your business WhatsApp number, approved through Meta.",
  messenger: "Messages sent to your Facebook Page.",
  instagram: "DMs to your Instagram business account.",
  telegram: "A Telegram bot for your agency.",
  email: "A mailbox that delivers into the inbox.",
  sms: "Text messages to and from your clients.",
};

interface ChannelCardProps {
  group: ChannelGroup;
  health: ChannelHealth | undefined;
  canWrite: boolean;
  /** Channel type whose connect link is being generated, if any. */
  pendingType: string | null;
  removingId: string | null;
  onConnect: (type: string) => void;
  onDelegate: (type: string) => void;
  onDisconnect: (channel: SsChannel) => void;
}

function Avatar({ channel }: { channel: SsChannel }) {
  if (channel.avatar_url) {
    return <img src={channel.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-social-page text-[12px] font-semibold text-social-muted" aria-hidden>
      {(channel.name || channel.channel_type).charAt(0).toUpperCase()}
    </span>
  );
}

/** One channel type: what it is, the accounts connected to it, and how to add or fix one. */
export function ChannelCard({ group, health, canWrite, pendingType, removingId, onConnect, onDelegate, onDisconnect }: ChannelCardProps) {
  const { type, channels, connectable } = group;
  const label = channelLabel(type);
  const summary = groupStatus(channels, health);
  const pending = pendingType === type;
  const busy = pendingType !== null;
  const nameOf = (c: SsChannel) => c.name || label;

  return (
    <article
      className="flex min-w-0 flex-col rounded-2xl border border-social-border bg-card"
      aria-labelledby={`channel-${type}-h`}
      data-testid={`channel-card-${type}`}
    >
      <header className="flex items-start gap-3 p-4 xl:p-5">
        <ChannelIcon type={type} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[15px] font-semibold leading-tight" id={`channel-${type}-h`}>
              {label}
            </h3>
            <StatusPill tone={summary.tone} className="px-2.5 py-[2px]">
              {summary.label}
            </StatusPill>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-social-muted xl:text-[13px]">{DESCRIPTIONS[type] ?? "Messages from this channel arrive in the inbox."}</p>
        </div>
      </header>

      {channels.length > 0 && (
        <ul className="divide-y divide-social-border border-t border-social-border">
          {channels.map((c) => {
            const status = channelStatus(c, health);
            const removing = removingId === c.id;
            return (
              <li key={c.id} className="flex min-w-0 items-center gap-3 px-4 py-2.5 xl:px-5" data-testid={`channel-row-${c.id}`}>
                <Avatar channel={c} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold xl:text-[14px]">{nameOf(c)}</div>
                  <div className="truncate text-[12px] text-social-muted">{channelSubtitle(c)}</div>
                </div>
                {status.kind === "needs_reconnect" && canWrite && connectable ? (
                  <Button
                    type="button"
                    className={cn(PRIMARY_ACTION, "h-8 min-h-0 px-3 text-[12px] [&_svg]:size-3.5")}
                    disabled={busy}
                    aria-label={`Reconnect ${nameOf(c)}`}
                    onClick={() => onConnect(type)}
                    data-testid={`button-reconnect-${c.id}`}
                  >
                    {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                    Reconnect
                  </Button>
                ) : (
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                )}
                {canWrite && (
                  <button
                    type="button"
                    className={ICON_ACTION}
                    disabled={removing}
                    aria-label={`Disconnect ${nameOf(c)}`}
                    title="Disconnect"
                    onClick={() => onDisconnect(c)}
                    data-testid={`button-disconnect-${c.id}`}
                  >
                    {removing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Unplug className="h-4 w-4" aria-hidden />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && connectable && (
        <footer className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-social-border px-4 py-3 xl:px-5">
          <Button
            type="button"
            variant={channels.length > 0 ? "outline" : "default"}
            className={cn(channels.length > 0 ? [OUTLINE_ACTION, CARD_OUTLINE] : [PRIMARY_ACTION, CARD_PRIMARY])}
            disabled={busy}
            aria-label={channels.length > 0 ? `Connect another ${label} account` : `Connect ${label}`}
            onClick={() => onConnect(type)}
            data-testid={`button-connect-${type}`}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {channels.length > 0 ? "Connect another" : "Connect"}
          </Button>
          <button
            type="button"
            className={TEXT_ACTION}
            aria-label={`Email link to a colleague to connect ${label}`}
            onClick={() => onDelegate(type)}
            data-testid={`button-delegate-${type}`}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Email link to a colleague
          </button>
        </footer>
      )}
    </article>
  );
}
