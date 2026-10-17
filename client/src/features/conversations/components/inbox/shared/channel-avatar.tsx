import { Instagram, Mail, MessageCircle, MessageSquare, Phone, type LucideIcon } from "lucide-react";
import type { ConversationChannel } from "../../../types";
import { cn } from "@/lib/utils";

export interface ChannelMeta {
  label: string;
  /** Brand colour (badge background). */
  color: string;
  /** Darker shade for text on the tint. */
  dark: string;
  /** Light background tint. */
  tint: string;
  Icon: LucideIcon;
}

export const CHANNEL_META: Record<ConversationChannel, ChannelMeta> = {
  whatsapp: { label: "WhatsApp", color: "#10B981", dark: "#047857", tint: "#D1FAE5", Icon: Phone },
  messenger: { label: "Messenger", color: "#3B82F6", dark: "#1D4ED8", tint: "#DBEAFE", Icon: MessageCircle },
  email: { label: "Email", color: "#64748B", dark: "#334155", tint: "#EEF2F7", Icon: Mail },
  sms: { label: "SMS", color: "#8B5CF6", dark: "#6D28D9", tint: "#EDE9FE", Icon: MessageSquare },
  instagram: { label: "Instagram", color: "#E1306C", dark: "#BE185D", tint: "#FCE7F3", Icon: Instagram },
};

const AVATAR_TONES = ["#F97316", "#0EA5E9", "#8B5CF6", "#10B981", "#EC4899", "#64748B", "#EAB308", "#14B8A6"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

const TEXT_SIZE: Record<40 | 44 | 64, string> = { 40: "text-[14px]", 44: "text-[15px]", 64: "text-[22px]" };

export interface ChannelAvatarProps {
  name: string;
  avatarUrl?: string;
  channel: ConversationChannel;
  size?: 40 | 44 | 64;
  badge?: boolean;
}

export function ChannelAvatar({ name, avatarUrl, channel, size = 44, badge = true }: ChannelAvatarProps) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.Icon;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          className={cn("flex h-full w-full items-center justify-center rounded-full font-semibold text-white", TEXT_SIZE[size])}
          style={{ backgroundColor: toneFor(name) }}
          aria-hidden="true"
        >
          {initialsOf(name)}
        </div>
      )}
      {badge && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full text-white ring-2 ring-white dark:ring-background"
          style={{ backgroundColor: meta.color }}
          title={meta.label}
        >
          <Icon className="h-[10px] w-[10px]" />
        </span>
      )}
    </div>
  );
}
