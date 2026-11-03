import { createHash } from "node:crypto";
import { AppError } from "../../utils/error-handler";
import { createRecentSendGuard } from "../../utils/recent-send-guard";
import type { Scope } from "../../utils/scope";
import { channelsService } from "../channels/channels.service";
import { contactLinkService } from "../contact-link/contact-link.service";
import { conversationsService } from "../conversations/conversations.service";
import { messagesService } from "../messages/messages.service";
import { neonClientService } from "../neon-client/neon-client.service";
import { normalisePhone } from "../sms/sms.service";
import type { CheckExistingResponse, OpenOrCreateResponse } from "../quote-share/quote-share.types";
import {
  isWindowClosed,
  isWindowMessage,
  isWindowRejection,
  linkClientToConversationContact,
  pickWhatsappChannel,
  resolveVariableValues,
  sendTemplate,
  templateRecipient,
} from "../whatsapp-templates/whatsapp-delivery.service";
import { whatsappSettingsService } from "../whatsapp-templates/whatsapp-settings.service";
import type { SendTemplateResponse, TemplateRecipient, WhatsappTemplateSettings } from "../whatsapp-templates/whatsapp-templates.types";
import type {
  SendWhatsappUpdateResult,
  UpdateTemplateSettings,
  UpdateTemplateStatus,
  WhatsappUpdateWindow,
} from "./whatsapp-updates.types";

// Lets agents message a client on WhatsApp after the 24h customer-service window
// has closed. Inside the window the text goes out as a normal message; outside it
// goes out through the agency's "General update" template, with the agent's text
// in the placeholder marked "message". Unlike the quote send there is no wa.me
// fallback: a failure is an error the agent sees.

// Same-text double-click / retry guard for template sends (billed by Meta).
const sendGuard = createRecentSendGuard(30_000);
const DUPLICATE_MESSAGE = "This update was just sent";
const MISSING_TEMPLATE_MESSAGE = "No General update template is set. Ask a manager to choose one in Integrations.";

function textHash(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

function requireOrgId(scope: Scope): string {
  if (!scope.orgId) throw new AppError("No organisation in scope", 400);
  return scope.orgId;
}

function firstWord(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().split(/\s+/)[0] || null;
}

// Linked Travana client's first name, then the SendSeven contact's, else null
// (the template then greets "there").
async function conversationFirstName(
  contact: Record<string, unknown> | null | undefined,
  contactId: string | null | undefined,
  scope: Scope,
): Promise<string | null> {
  if (contactId) {
    try {
      const status = await contactLinkService.getStatus(contactId, {}, scope);
      const linked = firstWord(status.linkedClient?.firstName);
      if (linked) return linked;
    } catch {
      // Fall through to the contact's own name.
    }
  }
  return firstWord(contact?.first_name) ?? firstWord(contact?.name) ?? firstWord(contact?.display_name);
}

interface TemplateSend {
  orgId: string;
  userId: string;
  text: string;
  settings: WhatsappTemplateSettings;
  channelId: string;
  recipient: TemplateRecipient;
  clientFirstName: string | null;
  guardKey: string;
}

// Closed-window path. Any rejection is surfaced as a 502 for the agent to read.
async function sendViaTemplate(args: TemplateSend): Promise<SendTemplateResponse> {
  if (!args.settings.templateName) throw new AppError(MISSING_TEMPLATE_MESSAGE, 409, true, "update_template_missing");
  sendGuard.assert(args.guardKey, DUPLICATE_MESSAGE);

  const variableValues = await resolveVariableValues(args.settings.variables, {
    orgId: args.orgId,
    userId: args.userId,
    clientFirstName: args.clientFirstName,
    message: args.text,
  });
  let res: SendTemplateResponse;
  try {
    res = await sendTemplate({
      templateName: args.settings.templateName,
      language: args.settings.templateLanguage,
      channelId: args.channelId,
      recipient: args.recipient,
      variableValues,
    });
  } catch (err) {
    const detail = err instanceof AppError ? err.message : "unknown error";
    console.warn(`[whatsapp-updates] template "${args.settings.templateName}" send failed: ${detail}`);
    throw new AppError(`WhatsApp didn't accept the update: ${detail}`, 502, true, "template_failed");
  }
  if (res.success !== true) {
    const reason = res.error_details ?? res.error ?? "unknown error";
    console.warn(`[whatsapp-updates] template "${args.settings.templateName}" rejected: ${reason}`, res);
    throw new AppError(`WhatsApp didn't accept the update: ${reason}`, 502, true, "template_failed");
  }
  await messagesService.afterStaffSend(args.orgId, res.conversation_id, args.userId);
  sendGuard.record(args.guardKey);
  return res;
}

// Free-text path. Returns false when WhatsApp refused because the window is
// closed (the caller then uses the template); any other failure throws.
async function sendFreeText(orgId: string, userId: string, conversationId: string, channelId: string, text: string): Promise<boolean> {
  try {
    const sent = await messagesService.send(orgId, { conversation_id: conversationId, channel_id: channelId, message_type: "text", text }, userId);
    if (sent?.status === "failed" || sent?.error_message) {
      const reason = sent.error_message ?? "";
      if (isWindowMessage(reason)) return false;
      throw new AppError(reason || "WhatsApp message failed to send", 502);
    }
    return true;
  } catch (err) {
    if (isWindowRejection(err)) return false;
    throw err;
  }
}

async function getWindow(conversationId: string): Promise<WhatsappUpdateWindow> {
  try {
    const w = await conversationsService.getWhatsappWindow(conversationId);
    return {
      known: true,
      inWindow: w.inWindow,
      requiresTemplate: w.requiresTemplate,
      remainingSeconds: w.remainingSeconds,
      windowEndAt: w.windowEndAt,
      lastCustomerMessageAt: w.lastCustomerMessageAt,
    };
  } catch (err) {
    console.warn(`[whatsapp-updates] could not read the window for ${conversationId}:`, err);
    return { known: false };
  }
}

export const whatsappUpdatesService = {
  getSettings: (orgId: string): Promise<UpdateTemplateSettings> => whatsappSettingsService.getUpdate(orgId),

  saveSettings: (orgId: string, input: UpdateTemplateSettings, userId: string | null): Promise<UpdateTemplateSettings> =>
    whatsappSettingsService.saveUpdate(orgId, input, userId),

  async getTemplateStatus(orgId: string): Promise<UpdateTemplateStatus> {
    const s = await whatsappSettingsService.getUpdate(orgId);
    return { configured: !!s.templateName, templateName: s.templateName, channelId: s.channelId };
  },

  getWindow,

  async sendToConversation(conversationId: string, rawText: string, userId: string, scope: Scope): Promise<SendWhatsappUpdateResult> {
    const orgId = requireOrgId(scope);
    const text = rawText.trim();
    const conversation = await conversationsService.getById(orgId, conversationId);
    if (conversation.channel_type !== "whatsapp") throw new AppError("Updates can only be sent on WhatsApp", 400);

    const window = await getWindow(conversationId);
    const closed = window.known && (window.requiresTemplate || !window.inWindow);
    // Open or unknown: try the free text first; a window rejection falls through to the template.
    if (!closed && (await sendFreeText(orgId, userId, conversationId, conversation.channel_id, text))) {
      return { conversationId, viaTemplate: false };
    }

    const settings = await whatsappSettingsService.getUpdate(orgId);
    const res = await sendViaTemplate({
      orgId,
      userId,
      text,
      settings,
      channelId: conversation.channel_id,
      recipient: { conversation_id: conversationId },
      clientFirstName: await conversationFirstName(conversation.contact, conversation.contact_id, scope),
      guardKey: `${orgId}:${conversationId}:${textHash(text)}`,
    });
    return { conversationId: res.conversation_id, viaTemplate: true };
  },

  async sendToClient(clientId: string, channelId: string, rawText: string, userId: string, scope: Scope): Promise<SendWhatsappUpdateResult> {
    const orgId = requireOrgId(scope);
    const text = rawText.trim();
    // Out-of-scope clients read as 404.
    const client = await neonClientService.getNeonClientById(clientId, scope);
    const link = await contactLinkService.getByClient(clientId, scope);

    const channels = await channelsService.listChannels(true);
    const channel = pickWhatsappChannel(channels.filter((c) => c.id === channelId), null);
    if (!channel) throw new AppError("Choose an active, verified WhatsApp channel", 400);

    const template = async (conversationId: string | null): Promise<SendWhatsappUpdateResult> => {
      const settings = await whatsappSettingsService.getUpdate(orgId);
      const res = await sendViaTemplate({
        orgId,
        userId,
        text,
        settings,
        channelId: channel.id,
        recipient: templateRecipient({ conversationId, contactId: link.contactId, phone: client.phoneNumber }),
        clientFirstName: client.firstName,
        guardKey: `${orgId}:client:${clientId}:${textHash(text)}`,
      });
      // Sent by phone number alone: SendSeven made a contact we have not linked yet.
      if (!link.contactId) await linkClientToConversationContact(res.conversation_id, clientId, scope);
      return { conversationId: res.conversation_id, viaTemplate: true };
    };

    // Never messaged the business number: the window is closed by definition.
    if (!link.contactId) {
      const settings = await whatsappSettingsService.getUpdate(orgId);
      if (!settings.templateName) throw new AppError(MISSING_TEMPLATE_MESSAGE, 409, true, "update_template_missing");
      if (!normalisePhone(client.phoneNumber)) throw new AppError("This client has no phone number to message on WhatsApp", 422);
      return await template(null);
    }

    const lookup = { contact_id: link.contactId, channel_id: channel.id };
    const existing = (await conversationsService.checkExisting(lookup)) as CheckExistingResponse;
    if (isWindowClosed(existing)) return await template(existing.existing_open_conversation_id ?? null);

    let conversationId: string;
    if (existing.has_existing_open && existing.existing_open_conversation_id) {
      conversationId = existing.existing_open_conversation_id;
    } else {
      const opened = (await conversationsService.openOrCreate({ ...lookup, reopen_existing: true })) as OpenOrCreateResponse;
      if (isWindowClosed(opened)) return await template(opened.conversation_id ?? null);
      conversationId = opened.conversation_id;
    }

    if (await sendFreeText(orgId, userId, conversationId, channel.id, text)) return { conversationId, viaTemplate: false };
    return await template(conversationId);
  },
};
