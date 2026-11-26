import type { NeonClient } from "@shared/schema";
import { AppError } from "../../utils/error-handler";
import { holdsHomeworkerRole, type Scope } from "../../utils/scope";
import { isSendSevenConfigured } from "../../utils/sendseven";
import { channelsService } from "../channels/channels.service";
import { contactLinkRepository } from "../contact-link/contact-link.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import { isSmsConfigured, normalisePhone } from "../sms/sms.service";
import { pickWhatsappChannel } from "../whatsapp-templates/whatsapp-delivery.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import { customerMessagingService, SettingsUnavailableError } from "./customer-messaging.service";
import { DEFAULT_AUTO_CHANNEL, type AutoChannel } from "./customer-messaging.types";
import type { AvailabilityResult, ChannelAvailability, StaffPurpose } from "./customer-messaging-staff.types";

// The "Send by" choice: for one customer and one message type, can it go by WhatsApp, can it go by SMS, and if
// not, why (in plain words the staff member can read). It only reads; nothing is ever sent from here.

export const UNAVAILABLE = {
  noPhone: "This customer has no phone number on file.",
  smsNotConfigured: "The SMS service isn't set up.",
  optedOut: "This customer has opted out of text messages.",
} as const;

/** Shown on a WhatsApp option that will open WhatsApp on the staff member's own device instead of sending from the inbox. */
export const DEVICE_NOTE = "Opens WhatsApp on your device.";

const ok = (): ChannelAvailability => ({ available: true });
const no = (reason: string): ChannelAvailability => ({ available: false, reason });

/**
 * WhatsApp is available whenever the customer has a phone number, for every role and every agency (every customer must
 * stay reachable). When the message cannot go through the agency's own WhatsApp inbox (homeworker, not connected, no number,
 * or, for the sign-in link, no template and no chat) the option carries a note saying it opens WhatsApp on the device.
 */
async function whatsappAvailability(client: NeonClient, purpose: StaffPurpose, scope: Scope): Promise<ChannelAvailability> {
  if (!normalisePhone(client.phoneNumber)) return no(UNAVAILABLE.noPhone);
  const onDevice: ChannelAvailability = { available: true, note: DEVICE_NOTE };
  if (holdsHomeworkerRole(scope) || !isSendSevenConfigured()) return onDevice;

  // Every read below is guarded: a failing settings read or SendSeven call degrades to "opens WhatsApp on your device",
  // it never turns into an error that leaves the staff member with no way to send.
  let settings;
  try {
    settings = purpose === "quote_link" ? await whatsappSettingsService.getQuote(scope.orgId) : await whatsappSettingsService.getPinReset(scope.orgId);
    if (!pickWhatsappChannel(await channelsService.listChannels(true), settings.channelId)) return onDevice;
  } catch (err) {
    console.warn(`[customer-messaging] availability could not read the WhatsApp setup for org ${scope.orgId}:`, err instanceof AppError ? err.message : err);
    return onDevice;
  }
  // A quote link with no template can still go in an open chat, and otherwise falls back to the device: no note.
  if (purpose === "quote_link") return ok();
  // The sign-in link needs the sign-in template, or a chat the customer already has with the agency; without either it opens on the device.
  if (!settings.templateName) {
    try {
      const link = await contactLinkRepository.findByClient(scope.orgId, client.id);
      if (!link?.sendsevenContactId) return onDevice;
    } catch (err) {
      console.warn(`[customer-messaging] availability could not read the chat link for client ${client.id}:`, err);
      return onDevice;
    }
  }
  return ok();
}

function smsAvailability(client: NeonClient): ChannelAvailability {
  if (!normalisePhone(client.phoneNumber)) return no(UNAVAILABLE.noPhone);
  if (!isSmsConfigured()) return no(UNAVAILABLE.smsNotConfigured);
  // Same rule as every staff text today: a customer who has opted out is skipped.
  if (!client.smsOptIn) return no(UNAVAILABLE.optedOut);
  return ok();
}

/** The agency's channel; an unreadable setting only affects what the choice starts on, so it falls back to WhatsApp. */
async function defaultChannel(orgId: string): Promise<AutoChannel> {
  try {
    return await customerMessagingService.getAutoChannel(orgId);
  } catch (err) {
    if (err instanceof SettingsUnavailableError) return DEFAULT_AUTO_CHANNEL;
    throw err;
  }
}

async function getAvailability(input: { clientId: string; purpose: StaffPurpose }, scope: Scope): Promise<AvailabilityResult> {
  if (!scope.orgId) throw new AppError("No organisation in scope", 400);
  // Same access as opening the client page; another agency's client reads as not found.
  const client = await neonClientService.viewNeonClientById(input.clientId, scope);
  const [whatsapp, channel] = await Promise.all([whatsappAvailability(client, input.purpose, scope), defaultChannel(scope.orgId)]);
  return { defaultChannel: channel, channels: { whatsapp, sms: smsAvailability(client) } };
}

export const customerMessagingAvailabilityService = { getAvailability };
