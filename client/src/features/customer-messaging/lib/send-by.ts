import type { SendAvailability, SendChannel, StaffSendResult } from "../types";

export const SEND_CHANNELS: ReadonlyArray<{ value: SendChannel; label: string }> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
];

export const channelLabel = (channel: SendChannel): string => (channel === "sms" ? "SMS" : "WhatsApp");

const other = (channel: SendChannel): SendChannel => (channel === "whatsapp" ? "sms" : "whatsapp");

/**
 * What the choice starts on: the agency's channel when it can be used; otherwise the other channel when only that
 * one can; when neither can, the agency's channel (shown disabled, with its reason). Only picks what is shown: a
 * send always goes by exactly the channel on screen and is never moved to the other one.
 */
export function initialChannel(availability: SendAvailability | undefined): SendChannel {
  if (!availability) return "whatsapp";
  const preferred = availability.defaultChannel;
  if (availability.channels[preferred].available) return preferred;
  if (availability.channels[other(preferred)].available) return other(preferred);
  return preferred;
}

/** The channel to use now: the staff member's pick while it is still usable, otherwise the starting channel. */
export function effectiveChannel(picked: SendChannel | null, availability: SendAvailability | undefined): SendChannel {
  if (picked && (!availability || availability.channels[picked].available)) return picked;
  return initialChannel(availability);
}

/** Can the Send button be pressed? While availability is still loading it cannot (the channel is not known yet). */
export function canSendBy(channel: SendChannel, availability: SendAvailability | undefined): boolean {
  return !!availability && availability.channels[channel].available;
}

export interface SendToast {
  title: string;
  description?: string;
  variant?: "destructive";
}

/** The message shown after a send; the wa.me fallback is handled by the caller (no toast for it). */
export function toastForResult(result: StaffSendResult, what: "quote" | "sign-in link"): SendToast | null {
  if (result.status === "fallback") return null;
  if (result.status === "not_sent") return { title: "Not sent", description: result.message, variant: "destructive" };
  if (what === "quote") {
    if (result.channel === "sms") return { title: "Quote link sent by SMS" };
    return { title: result.viaTemplate ? "Sent to the client as a WhatsApp template message" : "Quote link sent via WhatsApp" };
  }
  return { title: result.channel === "sms" ? "Sign-in link sent by SMS" : "Sign-in link sent via WhatsApp" };
}
