import type { SsChannel } from "@/features/conversations";
import type { PillTone } from "@/components/shared/status-pill";
import { CONNECTABLE_ORDER, channelStatus } from "./channel-status";
import type { ChannelHealth, ChannelStatusKind } from "../types";

export interface ChannelGroup {
  /** Lower-cased channel type, e.g. "whatsapp". */
  type: string;
  /** Whether the org can connect (another) account of this type. */
  connectable: boolean;
  channels: SsChannel[];
}

/**
 * One group per channel type, in the fixed connectable order first, then any other
 * type the org already has a channel for (email, sms…) in first-seen order.
 */
export function groupChannelsByType(connectable: string[], channels: SsChannel[] | undefined): ChannelGroup[] {
  const list = channels ?? [];
  const byType = new Map<string, SsChannel[]>();
  for (const c of list) {
    const t = c.channel_type.toLowerCase();
    byType.set(t, [...(byType.get(t) ?? []), c]);
  }
  const connectableSet = new Set(connectable.map((t) => t.toLowerCase()));
  const ordered = [
    ...CONNECTABLE_ORDER.filter((t) => connectableSet.has(t)),
    ...[...connectableSet].filter((t) => !CONNECTABLE_ORDER.includes(t as (typeof CONNECTABLE_ORDER)[number])),
  ];
  const groups: ChannelGroup[] = ordered.map((type) => ({ type, connectable: true, channels: byType.get(type) ?? [] }));
  for (const [type, chans] of byType) {
    if (!connectableSet.has(type)) groups.push({ type, connectable: false, channels: chans });
  }
  return groups;
}

export interface GroupStatusInfo {
  kind: ChannelStatusKind | "none";
  label: string;
  tone: PillTone;
}

/** The worst status among a type's channels: reconnect > setup incomplete > connected > inactive; "Not connected" when empty. */
export function groupStatus(channels: SsChannel[], health?: ChannelHealth | null): GroupStatusInfo {
  if (channels.length === 0) return { kind: "none", label: "Not connected", tone: "plain" };
  const kinds = channels.map((c) => channelStatus(c, health).kind);
  if (kinds.includes("needs_reconnect")) return { kind: "needs_reconnect", label: "Needs attention", tone: "bad" };
  if (kinds.includes("setup_incomplete")) return { kind: "setup_incomplete", label: "Setup incomplete", tone: "warn" };
  const connected = kinds.filter((k) => k === "connected").length;
  if (connected > 0) return { kind: "connected", label: connected > 1 ? `${connected} connected` : "Connected", tone: "good" };
  return { kind: "inactive", label: "Inactive", tone: "plain" };
}
