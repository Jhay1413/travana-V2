import { AlertTriangle } from "lucide-react";
import type { SsChannel } from "@/features/conversations";
import { channelLabel, healthFor } from "../lib/channel-status";
import type { ChannelHealth } from "../types";

/** Amber notice listing channels that must be reconnected. Renders nothing when none are affected. */
export function HealthBanner({ health, channels }: { health: ChannelHealth | undefined; channels: SsChannel[] | undefined }) {
  const broken = (channels ?? []).filter((c) => healthFor(c, health) !== undefined);
  if (broken.length === 0) return null;
  const names = broken.map((c) => c.name || channelLabel(c.channel_type));
  return (
    <section
      role="alert"
      className="flex min-w-0 items-start gap-3 rounded-2xl border border-stage-inplay-fg/30 bg-stage-inplay-bg p-4 text-stage-inplay-fg"
      data-testid="integrations-health-banner"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-[13px]">
        <b className="font-semibold">{names.length === 1 ? "A channel needs attention" : "Some channels need attention"}</b>
        <p className="mt-0.5">
          {names.join(", ")} {names.length === 1 ? "needs" : "need"} reconnecting. Reconnect {names.length === 1 ? "it" : "them"} from the tile below.
        </p>
      </div>
    </section>
  );
}
