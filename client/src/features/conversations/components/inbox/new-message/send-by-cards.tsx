import { cn } from "@/lib/utils";
import type { SsChannel } from "../../../api/channels.api";

interface ChannelOption {
  type: string;
  title: string;
  hint: string;
}

const OPTIONS: ChannelOption[] = [
  { type: "whatsapp", title: "WhatsApp", hint: "Free text, replies within 24h" },
  { type: "sms", title: "SMS", hint: "Sends as a text" },
  { type: "email", title: "Email", hint: "Add a subject" },
  { type: "messenger", title: "Messenger", hint: "Replies within 24h" },
  { type: "instagram", title: "Instagram", hint: "Replies within 24h" },
];

const isUsable = (c: SsChannel) => !!c.is_active && !!c.is_verified;

/** One channel per type; prefers active+verified, then active, then any. */
export function pickChannelByType(channels: SsChannel[], type: string): SsChannel | undefined {
  const ofType = channels.filter((c) => c.channel_type === type);
  return ofType.find(isUsable) ?? ofType.find((c) => c.is_active) ?? ofType[0];
}

interface SendByCardsProps {
  channels: SsChannel[];
  selectedChannelId: string | null;
  onSelect: (channel: SsChannel) => void;
  error?: string;
}

export function SendByCards({ channels, selectedChannelId, onSelect, error }: SendByCardsProps) {
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Send by" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const channel = pickChannelByType(channels, opt.type);
          const usable = channel !== undefined && isUsable(channel);
          const selected = usable && channel.id === selectedChannelId;
          return (
            <button
              key={opt.type}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!usable}
              onClick={() => channel && onSelect(channel)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                selected ? "border-social-orange bg-amber-50 dark:bg-amber-950/30" : "border-social-border hover:bg-muted",
                !usable && "cursor-not-allowed opacity-50 hover:bg-transparent",
              )}
            >
              <div className="text-sm font-medium">{opt.title}</div>
              <div className="text-xs text-social-muted">{usable ? opt.hint : "Not available"}</div>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
