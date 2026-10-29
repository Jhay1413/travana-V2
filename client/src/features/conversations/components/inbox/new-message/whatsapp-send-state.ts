export interface WhatsappSendStateInput {
  channelType: string | null;
  /** True once the contact-link lookup finished. */
  linkLoaded: boolean;
  /** The client already has a messaging contact. */
  hasContact: boolean;
  phone: string;
  /** Undefined while the template status loads. */
  templateConfigured: boolean | undefined;
  firstName: string;
}

export type WhatsappSendState =
  | { kind: "none" }
  | { kind: "info"; message: string }
  | { kind: "error"; message: string };

export const NO_CONTACT_MESSAGE = "This client has no messaging contact yet. Link or message them from a channel first.";
export const NO_PHONE_MESSAGE = "This client has no phone number to message on WhatsApp.";
export const NO_TEMPLATE_MESSAGE =
  "This client hasn't messaged you on WhatsApp yet, so the first message has to go out as a General update template. A manager needs to choose one in Integrations.";

/** What the New message dialog says about a client who has no messaging contact yet. */
export function whatsappSendState(input: WhatsappSendStateInput): WhatsappSendState {
  if (!input.linkLoaded || input.hasContact) return { kind: "none" };
  if (input.channelType !== "whatsapp") return { kind: "error", message: NO_CONTACT_MESSAGE };
  if (!input.phone.trim()) return { kind: "error", message: NO_PHONE_MESSAGE };
  if (input.templateConfigured === false) return { kind: "error", message: NO_TEMPLATE_MESSAGE };
  if (input.templateConfigured === undefined) return { kind: "none" };
  return {
    kind: "info",
    message: `${input.firstName} hasn't messaged you on WhatsApp yet, so this goes out as your General update template to ${input.phone.trim()}.`,
  };
}

/** Send is blocked by the state, and also while the template status is still loading. */
export function whatsappSendBlocked(state: WhatsappSendState, input: WhatsappSendStateInput): boolean {
  if (state.kind === "error") return true;
  return input.linkLoaded && !input.hasContact && input.channelType === "whatsapp" && input.templateConfigured === undefined;
}
