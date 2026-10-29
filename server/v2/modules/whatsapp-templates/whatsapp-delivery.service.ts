import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type { SsChannel } from "../channels/channels.types";
import { contactLinkService } from "../contact-link/contact-link.service";
import { conversationsService } from "../conversations/conversations.service";
import { organizationRepository } from "../organization/organization.repository";
import { normalisePhone } from "../sms/sms.service";
import { userRepository } from "../user/user.repository";
import { whatsappTemplatesRepository } from "./whatsapp-templates.repository";
import type {
  SendTemplateResponse,
  TemplateRecipient,
  WhatsappTemplateSettings,
  WhatsappWindowInfo,
} from "./whatsapp-templates.types";

// Shared WhatsApp delivery rules used by every send that may need a template
// (quote links, general updates): is the 24h window closed, who a template goes
// to, what its placeholders hold, and the SendSeven call itself.

/** Meta caps a template body at 1024 characters; the agent's message is limited well under that. */
export const MAX_UPDATE_MESSAGE_LENGTH = 700;

// Closed when SendSeven says a template is required or the window is not open.
// A null window_status is unknown, not closed: free text is tried and a
// rejection falls back to the template.
export function isWindowClosed(res: WhatsappWindowInfo | null | undefined): boolean {
  if (!res) return false;
  if (res.requires_template === true) return true;
  const s = res.window_status;
  if (!s || typeof s !== "object") return false;
  return s.in_window === false || s.requires_template === true;
}

// Window/template-rule phrasing only; a bare mention of "template" is not enough.
const WINDOW_ERROR_PATTERN =
  /24[s-]?(?:h|hr|hour)|messaging window|customer service window|service window|window (?:has )?(?:closed|expired)|outside (?:of )?the .*window|session (?:has )?(?:closed|expired)|template (?:message )?(?:is )?(?:required|needed)|requires? (?:a )?template|re-?engage/i;

export function isWindowMessage(message: string): boolean {
  return WINDOW_ERROR_PATTERN.test(message);
}

// A rejected freeform send that is about the window/template rule (not a
// transport or auth failure) is the closed-window case in disguise.
export function isWindowRejection(err: unknown): boolean {
  return (
    err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500 && isWindowMessage(err.message)
  );
}

// The org's saved template channel wins when it is still usable; otherwise the
// first active, verified WhatsApp channel. Every SendSeven call in one send uses it.
export function pickWhatsappChannel(channels: SsChannel[], preferredId: string | null): SsChannel | undefined {
  const eligible = channels.filter((c) => c.channel_type === "whatsapp" && c.is_active === true && c.is_verified === true);
  return (preferredId ? eligible.find((c) => c.id === preferredId) : undefined) ?? eligible[0];
}

// Who the template goes to. An open conversation already carries the client's
// WhatsApp identity, so it is the recipient on its own: passing contact_id as
// well makes SendSeven resolve the contact's own WhatsApp method, which a
// contact created from an inbound chat may not have ("Contact has no WhatsApp
// ID or phone number"). Without a conversation, send to the contact and add the
// client's phone as its WhatsApp id so SendSeven can create that method. With no
// contact at all, the phone number alone is the recipient and SendSeven creates
// the contact and conversation itself.
export function templateRecipient(args: {
  conversationId: string | null;
  contactId: string | null;
  phone: string | null | undefined;
}): TemplateRecipient {
  if (args.conversationId) return { conversation_id: args.conversationId };
  const phone = normalisePhone(args.phone);
  const whatsapp = phone ? { whatsapp_id: phone.replace(/^\+/, "") } : {};
  if (!args.contactId) return whatsapp;
  return { contact_id: args.contactId, conversation_id: null, ...whatsapp };
}

// Meta rejects template parameters containing newlines, tabs or 4+ consecutive spaces.
export function sanitizeTemplateParam(text: string): string {
  return text.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, " ").trim();
}

function nonEmpty(value: string | null | undefined, alt: string): string {
  const v = (value ?? "").trim();
  return v || alt;
}

export interface VariableContext {
  orgId: string;
  userId: string;
  clientFirstName: string | null | undefined;
  quoteUrl?: string;
  message?: string;
}

// Meta rejects empty template parameters, so every resolved value is non-empty.
export async function resolveVariableValues(
  variables: WhatsappTemplateSettings["variables"],
  ctx: VariableContext,
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
        // Validators keep quote_link out of update templates, so a missing link is a bug.
        if (!ctx.quoteUrl) throw new AppError("Quote link is not available for this send", 500);
        values[key] = ctx.quoteUrl;
        break;
      case "message":
        if (ctx.message === undefined) throw new AppError("Message is not available for this send", 500);
        values[key] = nonEmpty(sanitizeTemplateParam(ctx.message), "-");
        break;
      case "custom":
        values[key] = nonEmpty(variable.text, "-");
        break;
    }
  }
  return values;
}

// Sends the approved template through SendSeven and returns its raw response.
// Callers decide what a failure means (quote falls back to wa.me, update throws).
export function sendTemplate(args: {
  templateName: string;
  language: string | null | undefined;
  channelId: string;
  recipient: TemplateRecipient;
  variableValues: Record<string, string>;
}): Promise<SendTemplateResponse> {
  return whatsappTemplatesRepository.send(args.templateName, {
    ...args.recipient,
    channel_id: args.channelId,
    language: args.language ?? undefined,
    variable_values: args.variableValues,
  });
}

// After a template went to a bare phone number, SendSeven created the contact.
// Link the Travana client to it so the next send finds the conversation.
// Best-effort: the message is already out, so any failure here is swallowed.
export async function linkClientToConversationContact(
  conversationId: string | null | undefined,
  clientId: string,
  scope: Scope,
): Promise<void> {
  if (!conversationId || !scope.orgId) return;
  try {
    const conversation = await conversationsService.getById(scope.orgId, conversationId);
    if (!conversation.contact_id) return;
    const outcome = await contactLinkService.linkIfUnlinked(conversation.contact_id, clientId, scope);
    if (outcome === "linked_to_other") {
      console.warn(`[whatsapp-delivery] contact ${conversation.contact_id} is already linked to another client; left as is (client ${clientId})`);
    }
  } catch (err) {
    console.warn(`[whatsapp-delivery] could not link client ${clientId} to the new contact:`, err);
  }
}
