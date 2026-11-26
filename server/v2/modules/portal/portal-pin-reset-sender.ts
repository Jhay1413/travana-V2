import { AppError } from "../../utils/error-handler";
import { runWithSendSevenConfigAsync } from "../../utils/sendseven";
import { channelsService } from "../channels/channels.service";
import { contactLinkRepository } from "../contact-link/contact-link.repository";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { conversationsService } from "../conversations/conversations.service";
import { messagesRepository } from "../messages/messages.repository";
import { normalisePhone } from "../sms/sms.service";
import { messagesService } from "../messages/messages.service";
import { usageService } from "../usage/usage.service";
import {
  isWindowClosed,
  isWindowMessage,
  isWindowRejection,
  pickWhatsappChannel,
  resolveVariableValues,
  sendTemplate,
  templateRecipient,
} from "../whatsapp-templates/whatsapp-delivery.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import type { WhatsappTemplateSettings, WhatsappWindowInfo } from "../whatsapp-templates/whatsapp-templates.types";
import { buildSignInText } from "./portal-pin-reset-text";

/**
 * Sends a customer's one-time sign-in link on WhatsApp through the agency's own SendSeven workspace.
 *
 * It first works out, with no side effects and before any link exists, whether a message can be sent at all
 * (agency connected, WhatsApp channel, window state, template chosen when one is needed). Only then does it
 * call `reserve()` (an atomic cap check plus link mint, done by the caller) and send:
 *  - the customer's own open chat with the window open (SendSeven's own `in_window` / `requires_template`)
 *    -> a plain text message there;
 *  - the window closed, or text rejected for the window -> the agency's "Portal sign-in link" template;
 *  - any other case (never chatted, or the chat belongs to a contact whose WhatsApp number is NOT the
 *    customer's phone on file, e.g. a family member linked to the customer) -> the template to the phone on
 *    file. A sign-in link is never delivered to any number other than the customer's own phone on file.
 * There is no agent in the loop, so there is no wa.me fallback: when nothing can be sent the outcome says why
 * (the caller logs it) and the customer sees the same confirmation as always.
 * Never sends an SMS and never spends SMS credit.
 */

export type PinResetSkipReason = "not_configured" | "no_channel" | "no_template" | "capped" | "send_failed";

export type PinResetWhatsappOutcome =
  | { status: "sent"; viaTemplate: boolean }
  | { status: "skipped"; reason: PinResetSkipReason };

export interface PinResetWhatsappInput {
  orgId: string;
  clientId: string;
  firstName: string | null;
  orgName: string | null;
  /** The customer's phone on file, already normalised (+44...). The only number a link may ever go to. */
  phone: string;
  /**
   * Atomically reserves the one-time link (cap check and mint) and returns it, or null when a cap is reached
   * or the reservation cannot be made. Called only once a message is certain to be attempted.
   */
  reserve: () => Promise<string | null>;
  /** The plain-text message for a link; absent = the customer-requested reset wording ("expires in an hour"). */
  buildText?: (link: string) => string;
  /**
   * Set only when a staff member pressed Send: the send is then recorded like their quote send (usage source "manual",
   * assignment, live update, AI pause). Absent (the customer's own forgotten-PIN request) it stays an "auto" send.
   */
  staffUserId?: string;
}

type Plan =
  | { kind: "text"; conversationId: string }
  | { kind: "template"; conversationId: string | null; contactId: null };

interface Route {
  channelId: string;
  settings: WhatsappTemplateSettings;
}

const sent = (viaTemplate: boolean): PinResetWhatsappOutcome => ({ status: "sent", viaTemplate });
const skipped = (reason: PinResetSkipReason): PinResetWhatsappOutcome => ({ status: "skipped", reason });

/** The WhatsApp number of the SendSeven contact behind a conversation, normalised, or null when unknown. */
function conversationContactPhone(conversation: { contact?: Record<string, unknown> | null }): string | null {
  const raw = conversation.contact?.phone;
  return typeof raw === "string" ? normalisePhone(raw) : null;
}

/** Decides how the message would go, with no side effects. A skip here costs the customer no cap and mints no link. */
async function plan(input: PinResetWhatsappInput, route: Route): Promise<Plan | PinResetWhatsappOutcome> {
  const toPhone: Plan = { kind: "template", conversationId: null, contactId: null };
  const needTemplate = (p: Plan): Plan | PinResetWhatsappOutcome => (route.settings.templateName ? p : skipped("no_template"));

  const link = await contactLinkRepository.findByClient(input.orgId, input.clientId);
  // Never chatted with the business number: the window is closed by definition.
  if (!link?.sendsevenContactId) return needTemplate(toPhone);

  const existing = (await conversationsService.checkExisting({ contact_id: link.sendsevenContactId, channel_id: route.channelId })) as WhatsappWindowInfo & {
    has_existing_open?: boolean;
    existing_open_conversation_id?: string | null;
  };
  const conversationId = existing.has_existing_open ? existing.existing_open_conversation_id ?? null : null;
  // No open chat to use: send to the phone on file rather than pick a contact we cannot verify.
  if (!conversationId) return needTemplate(toPhone);

  // The linked contact must really be this customer's own number (a family member can be linked to a customer).
  const conversation = await conversationsService.getById(input.orgId, conversationId);
  if (conversationContactPhone(conversation) !== input.phone) return needTemplate(toPhone);

  if (isWindowClosed(existing)) return needTemplate({ kind: "template", conversationId, contactId: null });
  return { kind: "text", conversationId };
}

async function viaTemplate(input: PinResetWhatsappInput, route: Route, link: string, conversationId: string | null): Promise<PinResetWhatsappOutcome> {
  const { settings } = route;
  if (!settings.templateName) return skipped("no_template");

  // Meta rejects empty parameters, so every value is non-empty (see resolveVariableValues).
  const variableValues = await resolveVariableValues(settings.variables, {
    orgId: input.orgId,
    clientFirstName: input.firstName,
    signInLink: link,
  });
  const res = await sendTemplate({
    templateName: settings.templateName,
    language: settings.templateLanguage,
    channelId: route.channelId,
    // The contact path is never used: either an open chat verified as the customer's own, or the phone on file.
    recipient: templateRecipient({ conversationId, contactId: null, phone: input.phone }),
    variableValues,
  });
  if (res.success !== true) {
    console.warn(`[portal-pin-reset] template "${settings.templateName}" rejected: ${res.error_details ?? res.error ?? "unknown error"}`);
    return skipped("send_failed");
  }
  await afterSend(input, res.conversation_id);
  return sent(true);
}

/** Usage and follow-ups after a message went out: the staff hook for a staff send, the automatic usage count otherwise. */
async function afterSend(input: PinResetWhatsappInput, conversationId: string | null | undefined): Promise<void> {
  if (input.staffUserId) {
    await messagesService.afterStaffSend(input.orgId, conversationId, input.staffUserId);
    return;
  }
  void usageService.recordSendsevenSend({ orgId: input.orgId, source: "auto" });
}

async function deliver(input: PinResetWhatsappInput): Promise<PinResetWhatsappOutcome> {
  const settings = await whatsappSettingsService.getPinReset(input.orgId);
  const channel = pickWhatsappChannel(await channelsService.listChannels(true), settings.channelId);
  if (!channel) return skipped("no_channel");
  const route: Route = { channelId: channel.id, settings };

  const chosen = await plan(input, route);
  if ("status" in chosen) return chosen;

  const link = await input.reserve();
  if (!link) return skipped("capped");

  if (chosen.kind === "template") return viaTemplate(input, route, link, chosen.conversationId);

  const text = input.buildText ? input.buildText(link) : buildSignInText({ firstName: input.firstName, orgName: input.orgName, link });
  try {
    const message = await messagesRepository.send({ conversation_id: chosen.conversationId, channel_id: channel.id, message_type: "text", text });
    if (message?.status === "failed" || message?.error_message) {
      if (message.error_message && isWindowMessage(message.error_message)) return viaTemplate(input, route, link, chosen.conversationId);
      console.warn(`[portal-pin-reset] WhatsApp text failed: ${message.error_message ?? "unknown error"}`);
      return skipped("send_failed");
    }
  } catch (err) {
    if (isWindowRejection(err)) return viaTemplate(input, route, link, chosen.conversationId);
    throw err;
  }
  await afterSend(input, chosen.conversationId);
  return sent(false);
}

/** Never throws: a provider or network failure is logged and reported as `send_failed`. */
export async function sendPinResetWhatsapp(input: PinResetWhatsappInput): Promise<PinResetWhatsappOutcome> {
  try {
    const config = await conversationIntegrationService.resolveConfig(input.orgId);
    // No SendSeven workspace for this agency: fail closed, never fall back to another tenant's token.
    if (!config) return skipped("not_configured");
    return await runWithSendSevenConfigAsync(config, () => deliver(input));
  } catch (err) {
    console.error(`[portal-pin-reset] WhatsApp send failed${err instanceof AppError ? ` (${err.statusCode})` : ""}:`, err);
    return skipped("send_failed");
  }
}
