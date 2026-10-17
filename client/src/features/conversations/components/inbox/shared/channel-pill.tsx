import type { ConversationChannel } from "../../../types";
import { cn } from "@/lib/utils";
import { CHANNEL_META } from "./channel-avatar";

export interface ChannelPillProps {
  channel: ConversationChannel;
  className?: string;
}

export function ChannelPill({ channel, className }: ChannelPillProps) {
  const meta = CHANNEL_META[channel];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", className)}
      style={{ backgroundColor: meta.tint, color: meta.dark }}
    >
      {meta.label}
    </span>
  );
}
