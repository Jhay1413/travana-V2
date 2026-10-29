export interface NewMessageInput {
  clientId: string | null;
  contactId: string | null;
  channelId: string | null;
  channelType: string | null;
  subject: string;
  body: string;
}

export interface NewMessageErrors {
  clientId?: string;
  channel?: string;
  subject?: string;
  body?: string;
}

export const WHATSAPP_MAX_CHARS = 700;

export function validateNewMessage(input: NewMessageInput): NewMessageErrors {
  const errors: NewMessageErrors = {};
  const isWhatsapp = input.channelType === "whatsapp";
  // WhatsApp sends go by client id, so an unlinked client (no contact yet) is fine there.
  if (!input.clientId || (!isWhatsapp && !input.contactId)) errors.clientId = "Choose who the message is for.";
  if (!input.channelId || !input.channelType) errors.channel = "Choose how to send it.";
  if (input.channelType === "email" && !input.subject.trim()) errors.subject = "Add a subject for the email.";
  if (!input.body.trim()) errors.body = "Write a message.";
  else if (isWhatsapp && input.body.trim().length > WHATSAPP_MAX_CHARS) {
    errors.body = `WhatsApp messages from here can be up to ${WHATSAPP_MAX_CHARS} characters.`;
  }
  return errors;
}

/** Escape HTML and convert newlines to <br> for the email body. */
export function bodyToHtml(body: string): string {
  return body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br>");
}
