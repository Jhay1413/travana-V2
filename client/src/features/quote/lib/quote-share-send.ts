/**
 * What the share dialog's "Send" button should do. With a client + quote
 * attached the link goes out on WhatsApp (after a silent copy); otherwise it
 * is a plain copy-to-clipboard.
 */
export type ShareSendPlan = "whatsapp" | "link";

export function planShareSend(opts: { clientId?: string; quoteId?: string }): ShareSendPlan {
  return opts.clientId && opts.quoteId ? "whatsapp" : "link";
}
