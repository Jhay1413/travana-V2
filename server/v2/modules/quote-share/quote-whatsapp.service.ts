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
import { buildPublicQuoteMessage, resolveQuoteToken } from "../sms/sms.service";
import { quoteShareService } from "./quote-share.service";
import type {
  CheckExistingResponse,
  OpenOrCreateResponse,
  QuoteWhatsappFallbackReason,
  SendQuoteWhatsappResult,
  WhatsappWindowInfo,
} from "./quote-share.types";

// Sends a quote's public link to the client's WhatsApp through the agency's own
// SendSeven workspace. It never sends a template: when WhatsApp's 24h customer
// service window is closed (or SendSeven can't be used) it answers with a
// `fallback` so the agent can send from their own phone via a wa.me link.

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

function pickWhatsappChannel(channels: SsChannel[]): SsChannel | undefined {
  return channels.find((c) => c.channel_type === "whatsapp" && c.is_active === true && c.is_verified === true);
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
    const fallback = (reason: QuoteWhatsappFallbackReason): SendQuoteWhatsappResult => ({
      status: "fallback",
      reason,
      text,
      quoteUrl,
    });

    // Homeworkers are barred from SendSeven everywhere; never touch it for them.
    if (holdsHomeworkerRole(scope)) return fallback("not_allowed");

    const orgId = scope.orgId;
    if (!orgId || !isSendSevenConfigured()) return fallback("not_configured");

    const link = await contactLinkService.getByClient(clientId, scope);
    if (!link.contactId) return fallback("no_contact");

    const channel = pickWhatsappChannel(await channelsService.listChannels(true));
    if (!channel) return fallback("no_channel");

    const lookup = { contact_id: link.contactId, channel_id: channel.id };
    const existing = (await conversationsService.checkExisting(lookup)) as CheckExistingResponse;
    // Decide from the existing conversation first, so we never reopen a closed
    // conversation just to fall back.
    if (isWindowClosed(existing)) return fallback("window_closed");

    let conversationId: string;
    if (existing.has_existing_open && existing.existing_open_conversation_id) {
      conversationId = existing.existing_open_conversation_id;
    } else {
      const opened = (await conversationsService.openOrCreate({ ...lookup, reopen_existing: true })) as OpenOrCreateResponse;
      if (isWindowClosed(opened)) return fallback("window_closed");
      conversationId = opened.conversation_id;
    }

    const guardKey = `${orgId}:${quoteId}:${clientId}`;
    const now = Date.now();
    pruneRecentSends(now);
    const last = recentSends.get(guardKey);
    if (last !== undefined && now - last < DUPLICATE_WINDOW_MS) {
      throw new AppError("This quote was just sent to this client on WhatsApp. Wait a minute before sending it again.", 429);
    }

    let sent: SsMessage;
    try {
      sent = await messagesService.send(
        orgId,
        { conversation_id: conversationId, channel_id: channel.id, message_type: "text", text },
        userId,
      );
    } catch (err) {
      if (isWindowRejection(err)) return fallback("window_closed");
      throw err;
    }
    if (sent?.status === "failed" || sent?.error_message) {
      const reason = sent.error_message ?? "";
      if (isWindowMessage(reason)) return fallback("window_closed");
      throw new AppError(reason || "WhatsApp message failed to send", 502);
    }
    recentSends.set(guardKey, now);
    return { status: "sent", conversationId };
  },
};
