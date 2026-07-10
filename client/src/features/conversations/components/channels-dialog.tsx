import { useMemo, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  Trash2,
  Link2,
  Copy,
  ExternalLink,
  RadioTower,
  BadgeCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CHANNELS } from "../channels";
import type { ConversationChannel } from "../types";
import { useChannels, useChannelTypes, useCreateConnectToken, useDeleteChannel } from "../api/use-channels";
import type { SsChannel, ConnectTokenResult } from "../api/channels.api";

const KNOWN = new Set<ConversationChannel>(["whatsapp", "messenger", "instagram", "email", "sms"]);

// SendSeven's connect-token flow only supports these channel types (SMS/email
// are provisioned differently, not via the hosted connect page).
const CONNECTABLE = ["whatsapp", "messenger", "instagram", "telegram"];

function channelMeta(type: string) {
  const t = type.toLowerCase();
  if (KNOWN.has(t as ConversationChannel)) return CHANNELS[t as ConversationChannel];
  return null;
}

function ChannelIcon({ type }: { type: string }) {
  const meta = channelMeta(type);
  if (meta) {
    const Icon = meta.icon;
    return (
      <span className={cn("grid h-8 w-8 place-items-center rounded-full", meta.badge)}>
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60">
      <RadioTower className="h-4 w-4" />
    </span>
  );
}

function ConnectedChannelRow({ channel, onRemove, removing }: { channel: SsChannel; onRemove: () => void; removing: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/8 px-3 py-2 dark:border-white/8">
      <ChannelIcon type={channel.channel_type} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{channel.name || channel.channel_type}</span>
          {channel.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-green-500" />}
        </div>
        <div className="truncate text-xs text-black/45 dark:text-white/45">
          {channel.phone_number_formatted || channel.identifier || channel.channel_type}
          {channel.is_coexistence ? " · coexistence" : ""}
        </div>
      </div>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
          channel.is_active ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
        )}
      >
        {channel.is_active ? "Active" : "Inactive"}
      </span>
      <button
        onClick={onRemove}
        disabled={removing}
        title="Disconnect"
        className="grid h-7 w-7 place-items-center rounded-lg text-black/40 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:text-white/40 dark:hover:bg-red-500/10"
      >
        {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function ChannelsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const { data: channels, isLoading: channelsLoading } = useChannels(open);
  const { data: types } = useChannelTypes(open);
  const createToken = useCreateConnectToken();
  const removeChannel = useDeleteChannel();

  const available = useMemo(() => {
    const raw = types?.available ?? [];
    const list = raw.filter((t) => CONNECTABLE.includes(t));
    return list.length > 0 ? list : ["whatsapp", "messenger", "instagram"];
  }, [types]);
  const [selected, setSelected] = useState<string[]>([]);
  const [link, setLink] = useState<ConnectTokenResult | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Default the selection to every available type once loaded.
  const effectiveSelected = selected.length > 0 ? selected : available;

  const toggle = (t: string) =>
    setSelected((prev) => {
      const base = prev.length > 0 ? prev : available;
      return base.includes(t) ? base.filter((x) => x !== t) : [...base, t];
    });

  const generate = async () => {
    try {
      // Some providers reject non-https redirect URLs (e.g. localhost) — only
      // send it when we're on https.
      const redirect = window.location.protocol === "https:" ? `${window.location.origin}/conversations` : undefined;
      const result = await createToken.mutateAsync({
        allowed_channel_types: effectiveSelected,
        partner_redirect_url: redirect,
      });
      setLink(result);
    } catch (err) {
      toast({ title: "Couldn't generate link", description: (err as Error).message, variant: "destructive" });
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.connect_url);
      toast({ title: "Link copied", description: "Share it with the person connecting the account." });
    } catch {
      toast({ title: "Copy failed", description: "Copy the link manually.", variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    try {
      await removeChannel.mutateAsync(id);
      toast({ title: "Channel disconnected" });
    } catch (err) {
      toast({ title: "Couldn't disconnect", description: (err as Error).message, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RadioTower className="h-4 w-4" /> Channels
          </DialogTitle>
          <DialogDescription>
            Connect your WhatsApp, Messenger or Instagram accounts. You'll authorise them on SendSeven's secure connect
            page (Meta handles the approval) and they'll start feeding into this inbox.
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0: this is a grid item of DialogContent; without it the long
            connect URL's intrinsic width stretches the whole dialog (breaks truncate). */}
        <div className="min-w-0 space-y-5">
          {/* Connected channels */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">Connected</div>
            {channelsLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-black/50 dark:text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : channels && channels.length > 0 ? (
              <div className="space-y-2">
                {channels.map((ch) => (
                  <ConnectedChannelRow key={ch.id} channel={ch} onRemove={() => remove(ch.id)} removing={removingId === ch.id} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-black/12 px-3 py-4 text-center text-xs text-black/45 dark:border-white/12 dark:text-white/45">
                No channels connected yet.
              </div>
            )}
          </div>

          {/* Connect new */}
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">Connect a channel</div>
            <div className="mb-3 flex flex-wrap gap-2">
              {available.map((t) => {
                const on = effectiveSelected.includes(t);
                const meta = channelMeta(t);
                const label = meta?.label ?? t.charAt(0).toUpperCase() + t.slice(1);
                return (
                  <button
                    key={t}
                    onClick={() => toggle(t)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      on
                        ? "border-transparent bg-black text-white dark:bg-white dark:text-black"
                        : "border-black/12 text-black/60 hover:bg-black/5 dark:border-white/12 dark:text-white/60 dark:hover:bg-white/5",
                    )}
                  >
                    {on && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {label}
                  </button>
                );
              })}
            </div>

            {link ? (
              <div className="space-y-2 rounded-xl border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                  <Link2 className="h-3.5 w-3.5" /> Connect link ready · expires {new Date(link.expires_at).toLocaleString()}
                </div>
                <div className="truncate rounded-lg bg-black/5 px-2 py-1.5 font-mono text-[11px] dark:bg-white/10">{link.connect_url}</div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => window.open(link.connect_url, "_blank", "noopener")} className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" /> Open connect page
                  </Button>
                  <Button size="sm" variant="outline" onClick={copy} className="gap-1.5">
                    <Copy className="h-3.5 w-3.5" /> Copy link
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLink(null)}>
                    New link
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={generate} disabled={createToken.isPending || effectiveSelected.length === 0} className="gap-1.5">
                {createToken.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Generate connect link
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
