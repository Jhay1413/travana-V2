import type { SsChannel } from "@/features/conversations";
import type { ChannelHealth } from "../types";
import { channelStatus } from "./channel-status";

/** WhatsApp channels that are fully connected, in the order given. */
export function connectedWhatsappChannels(channels: SsChannel[] | undefined, health?: ChannelHealth | null): SsChannel[] {
  return (channels ?? []).filter((c) => c.channel_type.toLowerCase() === "whatsapp" && channelStatus(c, health).kind === "connected");
}

/** How a WhatsApp number is named in the UI: its label, else its formatted number, else its id. */
export const channelName = (c: SsChannel): string => c.name || c.phone_number_formatted || c.identifier || c.id;

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string; error?: string } };
}

/** Server message (carries Meta's rejection reason on 400s), falling back to the error message. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  const e = err as ApiErrorLike | null;
  return e?.response?.data?.message || e?.response?.data?.error || e?.message || fallback;
}
