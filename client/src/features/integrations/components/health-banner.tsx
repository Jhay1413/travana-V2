import { AlertTriangle } from "lucide-react";
import type { SsChannel } from "@/features/conversations";
import { channelLabel, healthFor } from "../lib/channel-status";
import type { ChannelHealth } from "../types";

/** Amber notice listing channels that must be reconnected. Renders nothing when none are affected. */
export function HealthBanner({ health, channels, canWrite }: { health: ChannelHealth | undefined; channels: SsChannel[] | undefined; canWrite: boolean }) {
  const broken = (channels ?? []).filter((c) => healthFor(c, health) !== undefined);
  if (broken.length === 0) return null;
  const names = broken.map((c) => c.name || channelLabel(c.channel_type));
  const one = names.length === 1;
  return (
    <section
      role="alert"
      className="flex min-w-0 items-start gap-3 rounded-2xl border border-stage-inplay-fg/25 bg-stage-inplay-bg px-4 py-3 text-stage-inplay-fg"
      data-testid="integrations-health-banner"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 text-[13px] leading-snug">
        <b className="font-semibold">{one ? "A channel lost access." : "Some channels lost access."}</b>{" "}
        {names.join(", ")} {one ? "needs" : "need"} reconnecting{canWrite ? ` — use Reconnect on ${one ? "its" : "their"} card below.` : ". Ask an admin to reconnect."}
      </p>
    </section>
  );
}
