import type { SsChannel, SsChannelTypes } from "@/features/conversations";
import type { PillTone } from "@/components/shared/status-pill";
import type { ChannelHealth, ChannelHealthIntegration, ChannelStatusKind } from "../types";

export const CONNECTABLE_ORDER = ["whatsapp", "messenger", "instagram", "telegram"] as const;
const FALLBACK_TYPES = ["whatsapp", "messenger", "instagram"];

export interface ChannelStatusInfo {
  kind: ChannelStatusKind;
  label: string;
  tone: PillTone;
}

/**
 * The health entry saying this channel lost access, or undefined. Matches by id, or by
 * channel_type + name when ids differ. Only disconnected + token_invalidated entries count.
 */
export function healthFor(
  channel: Pick<SsChannel, "id" | "name" | "channel_type">,
  health?: ChannelHealth | null,
): ChannelHealthIntegration | undefined {
  return health?.integrations.find(
    (i) =>
      i.connection_status === "disconnected" &&
      i.last_error === "token_invalidated" &&
      (i.id === channel.id ||
        (i.channel_type.toLowerCase() === channel.channel_type.toLowerCase() && i.name === channel.name)),
  );
}

/** Connected only when setup is complete, no reconnect is pending and the channel is active. */
export function channelStatus(
  channel: Pick<SsChannel, "id" | "name" | "channel_type" | "is_active" | "activation_status" | "setup_pending_reason">,
  health?: ChannelHealth | null,
): ChannelStatusInfo {
  if (healthFor(channel, health)) return { kind: "needs_reconnect", label: "Needs reconnecting", tone: "bad" };
  if (channel.activation_status === "AVAILABLE" || channel.setup_pending_reason) {
    return { kind: "setup_incomplete", label: "Setup incomplete", tone: "warn" };
  }
  if (channel.is_active === false) return { kind: "inactive", label: "Inactive", tone: "plain" };
  return { kind: "connected", label: "Connected", tone: "good" };
}

export function connectableTypes(types: Pick<SsChannelTypes, "available"> | null | undefined): string[] {
  const available = types?.available ?? [];
  const list = CONNECTABLE_ORDER.filter((t) => available.includes(t));
  return list.length > 0 ? list : [...FALLBACK_TYPES];
}

const LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  messenger: "Facebook Messenger",
  instagram: "Instagram",
  telegram: "Telegram",
};

export function channelLabel(type: string): string {
  const t = type.toLowerCase();
  return LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1);
}

/** Providers reject non-https redirects (e.g. localhost), so only send one on https. */
export function connectRedirectUrl(origin: string, protocol: string): string | undefined {
  return protocol === "https:" ? `${origin}/agency/integrations` : undefined;
}

export function channelSubtitle(
  channel: Pick<SsChannel, "phone_number_formatted" | "identifier" | "channel_type" | "is_coexistence">,
): string {
  const base = channel.phone_number_formatted || channel.identifier || channel.channel_type;
  return channel.is_coexistence ? `${base} · coexistence` : base;
}
