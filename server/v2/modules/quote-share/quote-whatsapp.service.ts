import { AppError } from "../../utils/error-handler";
import { holdsHomeworkerRole, type Scope } from "../../utils/scope";
import { isSendSevenConfigured } from "../../utils/sendseven";
import { channelsService } from "../channels/channels.service";
import { contactLinkService } from "../contact-link/contact-link.service";
import { conversationsService } from "../conversations/conversations.service";
import { messagesService } from "../messages/messages.service";
import type { SsMessage } from "../messages/messages.types";
import { neonClientService } from "../neon-client/neon-client.service";
import { buildPublicQuoteMessage, normalisePhone, resolveQuoteToken } from "../sms/sms.service";
import { quoteShareService } from "./quote-share.service";
import { createRecentSendGuard } from "../../utils/recent-send-guard";
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
import type { SendTemplateResponse } from "../whatsapp-templates/whatsapp-templates.types";
import type {
  CheckExistingResponse,
  OpenOrCreateResponse,
  QuoteTemplateSettings,
  QuoteWhatsappFallbackReason,
  SendQuoteWhatsappResult,
} from "./quote-share.types";

// Sends a quote's public link to the client's WhatsApp through the agency's own
// SendSeven workspace. In-window it sends free text. When WhatsApp's 24h customer
// service window is closed it sends the org's configured template instead (if
// any). A client with no linked SendSeven contact has never messaged the business
// number, so their window is closed by definition: the template goes straight to
// their phone number. When none of that is possible (or SendSeven can't be used)
// it answers with a `fallback` so the agent can send from their own phone via a
// wa.me link.

// Short-lived duplicate guard (mirrors the SMS send's 60s idempotency window).
// Only real SendSeven sends are recorded, never fallbacks or failures.
const sendGuard = createRecentSendGuard(60_000);
const DUPLICATE_MESSAGE = "This quote was just sent to this client on WhatsApp. Wait a minute before sending it again.";

interface TemplateSendContext {
  orgId: string;
  userId: string;
  scope: Scope;
  quoteId: string;
  clientId: string;
  clientFirstName: string | null | undefined;
  clientPhone: string | null | undefined;
  quoteUrl: string;
  /** Linked SendSeven contact; null when the client is unlinked and the send goes by phone number. */
  contactId: string | null;
  channelId: string;
  conversationId: string | null;
  settings: QuoteTemplateSettings;
  fallback: (reason: QuoteWhatsappFallbackReason, detail?: string) => SendQuoteWhatsappResult;
}

// Closed-window path: send the org's approved template through SendSeven.
async function sendViaTemplate(ctx: TemplateSendContext): Promise<SendQuoteWhatsappResult> {
  const { settings } = ctx;
  if (!settings.templateName) return ctx.fallback("window_closed");

  const guardKey = `${ctx.orgId}:${ctx.quoteId}:${ctx.clientId}`;
  sendGuard.assert(guardKey, DUPLICATE_MESSAGE);

  // Resolved outside the try: a DB failure here is a real 500, not a template fallback.
  const variableValues = await resolveVariableValues(settings.variables, {
    orgId: ctx.orgId,
    userId: ctx.userId,
    clientFirstName: ctx.clientFirstName,
    quoteUrl: ctx.quoteUrl,
  });
  let res: SendTemplateResponse;
  try {
    res = await sendTemplate({
      templateName: settings.templateName,
      language: settings.templateLanguage,
      channelId: ctx.channelId,
      recipient: templateRecipient({ conversationId: ctx.conversationId, contactId: ctx.contactId, phone: ctx.clientPhone }),
      variableValues,
    });
  } catch (err) {
    if (err instanceof AppError) {
      console.warn(`[quote-whatsapp] template "${settings.templateName}" send failed (${err.statusCode}): ${err.message}`);
      return ctx.fallback("template_failed", err.message);
    }
    console.error("[quote-whatsapp] template send failed", err);
    return ctx.fallback("template_failed", "unknown error");
  }
  if (res.success === true) {
    sendGuard.record(guardKey);
    // The template path used to skip the staff-send side effects (usage, auto-assign, realtime, AI pause).
    await messagesService.afterStaffSend(ctx.orgId, res.conversation_id, ctx.userId);
    // Sent by phone number alone: SendSeven made a contact we have not linked yet.
    if (!ctx.contactId) await linkClientToConversationContact(res.conversation_id, ctx.clientId, ctx.scope);
    return { status: "sent", conversationId: res.conversation_id, viaTemplate: true };
  }
  const reason = res.error_details ?? res.error ?? "unknown error";
  console.warn(`[quote-whatsapp] template "${settings.templateName}" rejected: ${reason}`, res);
  return ctx.fallback("template_failed", reason);
}

export const quoteWhatsappService = {
  async send(quoteId: string, clientId: string, userId: string, scope: Scope): Promise<SendQuoteWhatsappResult> {
    // Quote must be in the caller's org and workable by them; client must be in
    // scope; the quote must belong to that client. All fail closed.
    await quoteShareService.verifyAccess(quoteId, userId, scope);
    const client = await neonClientService.getNeonClientById(clientId, scope);
    // With an explicit quoteId this either returns the client's tokened quote or throws a 400.
    const quote = (await resolveQuoteToken(clientId, quoteId)) as { id: string; token: string };

    const { text, quoteUrl } = buildPublicQuoteMessage({ firstName: client.firstName, token: quote.token });
    const fallback = (reason: QuoteWhatsappFallbackReason, detail?: string): SendQuoteWhatsappResult => ({
      status: "fallback",
      reason,
      text,
      quoteUrl,
      ...(detail !== undefined ? { detail } : {}),
    });

    // Homeworkers are barred from SendSeven everywhere; never touch it for them.
    if (holdsHomeworkerRole(scope)) return fallback("not_allowed");

    const orgId = scope.orgId;
    if (!orgId || !isSendSevenConfigured()) return fallback("not_configured");

    const link = await contactLinkService.getByClient(clientId, scope);
    const settings = await whatsappSettingsService.getQuote(orgId);
    const channel = pickWhatsappChannel(await channelsService.listChannels(true), settings.channelId);
    if (!channel) return fallback("no_channel");

    const templateCtx = (conversationId: string | null): TemplateSendContext => ({
      orgId,
      userId,
      scope,
      quoteId,
      clientId,
      clientFirstName: client.firstName,
      clientPhone: client.phoneNumber,
      quoteUrl,
      contactId: link.contactId,
      channelId: channel.id,
      conversationId,
      settings,
      fallback,
    });

    // Unlinked client: no conversation to check or reopen. With a template and a
    // phone number the template is sent by number; otherwise the agent is told to
    // link the client (the fallback copy says so).
    if (!link.contactId) {
      if (!settings.templateName || !normalisePhone(client.phoneNumber)) return fallback("no_contact");
      return await sendViaTemplate(templateCtx(null));
    }

    const lookup = { contact_id: link.contactId, channel_id: channel.id };
    const existing = (await conversationsService.checkExisting(lookup)) as CheckExistingResponse;
    // Decide from the existing conversation first, so we never reopen a closed
    // conversation just to fall back.
    if (isWindowClosed(existing)) {
      return await sendViaTemplate(templateCtx(existing.existing_open_conversation_id ?? null));
    }

    let conversationId: string;
    if (existing.has_existing_open && existing.existing_open_conversation_id) {
      conversationId = existing.existing_open_conversation_id;
    } else {
      const opened = (await conversationsService.openOrCreate({ ...lookup, reopen_existing: true })) as OpenOrCreateResponse;
      if (isWindowClosed(opened)) return await sendViaTemplate(templateCtx(opened.conversation_id ?? null));
      conversationId = opened.conversation_id;
    }

    const guardKey = `${orgId}:${quoteId}:${clientId}`;
    sendGuard.assert(guardKey, DUPLICATE_MESSAGE);

    let sent: SsMessage;
    try {
      sent = await messagesService.send(
        orgId,
        { conversation_id: conversationId, channel_id: channel.id, message_type: "text", text },
        userId,
      );
    } catch (err) {
      if (isWindowRejection(err)) return await sendViaTemplate(templateCtx(conversationId));
      throw err;
    }
    if (sent?.status === "failed" || sent?.error_message) {
      const reason = sent.error_message ?? "";
      if (isWindowMessage(reason)) return await sendViaTemplate(templateCtx(conversationId));
      throw new AppError(reason || "WhatsApp message failed to send", 502);
    }
    sendGuard.record(guardKey);
    return { status: "sent", conversationId };
  },
};
