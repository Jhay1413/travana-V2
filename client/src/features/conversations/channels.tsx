import { Mail, MessageCircle, MessageSquare, Instagram, Send } from "lucide-react";
import type { ConversationChannel } from "./types";

// Per-channel presentation: icon, human label, and the colour tokens used for
// the small channel badge that sits on a contact's avatar and next to a name.
export interface ChannelMeta {
  label: string;
  icon: typeof Mail;
  /** Solid badge background + icon colour (used on avatar overlay). */
  badge: string;
  /** Soft chip classes (used for inline channel tags). */
  chip: string;
}

export const CHANNELS: Record<ConversationChannel, ChannelMeta> = {
  email: {
    label: "Email",
    icon: Mail,
    badge: "bg-amber-500 text-white",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  sms: {
    label: "SMS",
    icon: MessageCircle,
    badge: "bg-sky-500 text-white",
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: MessageSquare,
    badge: "bg-green-500 text-white",
    chip: "bg-green-500/15 text-green-600 dark:text-green-400",
  },
  messenger: {
    label: "Messenger",
    icon: Send,
    badge: "bg-blue-500 text-white",
    chip: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  instagram: {
    label: "Instagram",
    icon: Instagram,
    badge: "bg-gradient-to-br from-pink-500 to-purple-600 text-white",
    chip: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  },
};

export const CHANNEL_ORDER: ConversationChannel[] = [
  "email",
  "sms",
  "whatsapp",
  "messenger",
  "instagram",
];
