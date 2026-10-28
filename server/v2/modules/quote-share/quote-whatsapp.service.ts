import { AppError } from "../../utils/error-handler";
import { holdsHomeworkerRole, type Scope } from "../../utils/scope";
import { isSendSevenConfigured } from "../../utils/sendseven";
import { channelsService } from "../channels/channels.service";
import type { SsChannel } from "../channels/channels.types";
import { contactLinkService } from "../contact-link/contact-link.service";
import { conversationsService } from "../conversations/conversations.service";
import { messagesService } from "../messages/messages.service";
import type { SsMessage } from "../messages/messages.types";
import { neonClientService } from "../neon-client/neon-client.service";
import { organizationRepository } from "../organization/organization.repository";
import { userRepository } from "../user/user.repository";
import { buildPublicQuoteMessage, normalisePhone, resolveQuoteToken } from "../sms/sms.service";
import { quoteShareService } from "./quote-share.service";
import { quoteWhatsappRepository } from "./quote-whatsapp.repository";
import { quoteWhatsappSettingsService } from "./quote-whatsapp-settings.service";
import type {
  CheckExistingResponse,
  OpenOrCreateResponse,
  QuoteTemplateSettings,
  QuoteWhatsappFallbackReason,
  SendQuoteWhatsappResult,
  SendTemplateRequest,
  WhatsappWindowInfo,
} from "./quote-share.types";

// Sends a quote's public link to the client's WhatsApp through the agency's own
// SendSeven workspace. In-window it sends free text. When WhatsApp's 24h customer
// service window is closed it sends the org's configured template instead (if
// any). A client with no linked SendSeven contact has never messaged the business
// number, so their window is closed by definition: the template goes straight to
// their phone number. When none of that is possible (or SendSeven can't be used)
// it answers with a `fallback` so the agent can send from their own phone via a
// wa.me link.

// SendSeven's window_status payload is untyped upstream (Record<string, unknown>).
// Treat the window as closed when it says so under any of the plausible keys, or
// when the response flags that a template is required.
function isWindowClosed(res: WhatsappWindowInfo | null | undefined): boolean {
  if (!res) return false;
  if (res.requires_template === true) return true;
  const s = res.window_status;
  if (!s || typeof s !== "object") return false;
  if (s.requires_template === true) return true;
  for (const key of ["is_open", "window_open", "is_window_open", "can_send_freeform", "can_send_text"]) {
    if (s[key] === false) return true;
  }
  return s.is_closed === true || s.window_closed === true || s.expired === true;
}

// Window/template-rule phrasing only; a bare mention of "template" is not enough.
const WINDOW_ERROR_PATTERN =
  /24[s-]?(?:h|hr|hour)|messaging window|customer service window|service window|window (?:has )?(?:closed|expired)|outside (?:of )?the .*window|session (?:has )?(?:closed|expired)|template (?:message )?(?:is )?(?:required|needed)|requires? (?:a )?template|re-?engage/i;

function isWindowMessage(message: string): boolean {
  return WINDOW_ERROR_PATTERN.test(message);
}

// A rejected freeform send that is about the window/template rule (not a
// transport or auth failure) is the closed-window case in disguise.
function isWindowRejection(err: unknown): boolean {
  return (
    err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500 && isWindowMessage(err.message)
  );
}

// Short-lived duplicate guard (mirrors the SMS send's 60s idempotency window).
// Only real SendSeven sends are recorded, never fallbacks or failures.
const DUPLICATE_WINDOW_MS = 60_000;
const recentSends = new Map<string, number>();

function pruneRecentSends(now: number): void {
  recentSends.forEach((ts, k) => {
    if (now - ts > DUPLICATE_WINDOW_MS) recentSends.delete(k);
  });
}

// Throws 429 when this quote was already sent to this client within the window.
function assertNotRecentlySent(guardKey: string, now: number): void {
  pruneRecentSends(now);
  const last = recentSends.get(guardKey);
  if (last !== undefined && now - last < DUPLICATE_WINDOW_MS) {
    throw new AppError("This quote was just sent to this client on WhatsApp. Wait a minute before sending it again.", 429);
  }
}

interface TemplateSendContext {
  orgId: string;
  userId: string;
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

function nonEmpty(value: string | null | undefined, alt: string): string {
  const v = (value ?? "").trim();
  return v || alt;
}

// Meta rejects empty template parameters, so every resolved value is non-empty.
async function resolveVariableValues(
  variables: QuoteTemplateSettings["variables"],
  ctx: TemplateSendContext,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  let agentName: string | undefined;
  let agencyName: string | undefined;
  for (const [key, variable] of Object.entries(variables)) {
    switch (variable.source) {
      case "client_first_name":
        values[key] = nonEmpty(ctx.clientFirstName, "there");
        break;
      case "agent_name": {
        if (agentName === undefined) {
          const u = await userRepository.findById(ctx.userId);
          agentName = nonEmpty(u?.name, nonEmpty(u?.email?.split("@")[0], "your travel agent"));
        }
        values[key] = agentName;
        break;
      }
      case "agency_name": {
        if (agencyName === undefined) {
          const org = await organizationRepository.findById(ctx.orgId);
          agencyName = nonEmpty(org?.name, "our team");
        }
        values[key] = agencyName;
        break;
      }
      case "quote_link":
        values[key] = ctx.quoteUrl;
        break;
      case "custom":
        values[key] = nonEmpty(variable.text, "-");
        break;
    }
  }
  return values;
}

// Closed-window path: send the org's approved template through SendSeven.
// Who the template goes to. An open conversation already carries the client's
// WhatsApp identity, so it is the recipient on its own: passing contact_id as
// well makes SendSeven resolve the contact's own WhatsApp method, which a
// contact created from an inbound chat may not have ("Contact has no WhatsApp
// ID or phone number"). Without a conversation, send to the contact and add the
// client's phone as its WhatsApp id so SendSeven can create that method. With no
// contact at all, the phone number alone is the recipient and SendSeven creates
// the contact and conversation itself.
function templateRecipient(ctx: TemplateSendContext): Pick<SendTemplateRequest, "contact_id" | "conversation_id" | "whatsapp_id"> {
  if (ctx.conversationId) return { conversation_id: ctx.conversationId };
  const phone = normalisePhone(ctx.clientPhone);
  const whatsapp = phone ? { whatsapp_id: phone.replace(/^\+/, "") } : {};
  if (!ctx.contactId) return whatsapp;
  return { contact_id: ctx.contactId, conversation_id: null, ...whatsapp };
}

async function sendViaTemplate(ctx: TemplateSendContext): Promise<SendQuoteWhatsappResult> {
  const { settings } = ctx;
  if (!settings.templateName) return ctx.fallback("window_closed");

  const guardKey = `${ctx.orgId}:${ctx.quoteId}:${ctx.clientId}`;
  const now = Date.now();
  assertNotRecentlySent(guardKey, now);

  // Resolved outside the try: a DB failure here is a real 500, not a template fallback.
  const variableValues = await resolveVariableValues(settings.variables, ctx);
  try {
    const res = await quoteWhatsappRepository.sendTemplate(settings.templateName, {
      ...templateRecipient(ctx),
      channel_id: ctx.channelId,
      language: settings.templateLanguage ?? undefined,
      variable_values: variableValues,
    });
    if (res.success === true) {
      recentSends.set(guardKey, now);
      return { status: "sent", conversationId: res.conversation_id, viaTemplate: true };
    }
    const reason = res.error_details ?? res.error ?? "unknown error";
    console.warn(`[quote-whatsapp] template "${settings.templateName}" rejected: ${reason}`, res);
    return ctx.fallback("template_failed", reason);
  } catch (err) {
    if (err instanceof AppError) {
      console.warn(`[quote-whatsapp] template "${settings.templateName}" send failed (${err.statusCode}): ${err.message}`);
      return ctx.fallback("template_failed", err.message);
    }
    console.error("[quote-whatsapp] template send failed", err);
    return ctx.fallback("template_failed", "unknown error");
  }
}

// The org's saved template channel wins when it is still usable; otherwise the
// first active, verified WhatsApp channel. Every SendSeven call in one send uses it.
function pickWhatsappChannel(channels: SsChannel[], preferredId: string | null): SsChannel | undefined {
  const eligible = channels.filter((c) => c.channel_type === "whatsapp" && c.is_active === true && c.is_verified === true);
  return (preferredId ? eligible.find((c) => c.id === preferredId) : undefined) ?? eligible[0];
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
    const settings = await quoteWhatsappSettingsService.get(orgId);
    const channel = pickWhatsappChannel(await channelsService.listChannels(true), settings.channelId);
    if (!channel) return fallback("no_channel");

    const templateCtx = (conversationId: string | null): TemplateSendContext => ({
      orgId,
      userId,
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
    const now = Date.now();
    assertNotRecentlySent(guardKey, now);

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
    recentSends.set(guardKey, now);
    return { status: "sent", conversationId };
  },
};
