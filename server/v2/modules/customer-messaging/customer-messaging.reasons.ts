import type { SkipReason } from "./customer-messaging.types";

/** Why a message did not go out, as a lower-case fragment that reads after "Not sent — " on the client page. */
export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  org_suspended: "the agency account is suspended",
  no_phone: "customer has no phone number on file",
  opted_out: "customer opted out",
  not_connected: "WhatsApp is not connected",
  no_channel: "no WhatsApp number is connected",
  no_template: "no approved template and no open chat",
  duplicate: "the same message was just sent",
  homeworker: "homeworkers cannot send on WhatsApp",
  no_credit: "no text credit left",
  log_unavailable: "the message log is not ready yet",
  send_failed: "the provider could not send it",
  switched_off: "the message type is switched off",
  fully_paid: "the booking is already fully paid",
  client_not_found: "customer not found",
  not_configured: "the channel is not set up",
  capped: "too many sign-in links were sent to this customer in the last 24 hours",
  settings_unavailable: "the channel setting could not be read",
  no_quote_link: "there is no quote link to send",
  staff_fallback: "handed to the agent to send from their own WhatsApp",
  no_public_url: "the site address is not configured",
  no_contact: "not linked to a WhatsApp chat and no template to start one",
};

/** The plain text for a stored reason code; an unknown or empty code reads as a generic "Not sent". */
export function reasonText(reason: string | null | undefined): string | null {
  if (!reason) return null;
  return (SKIP_REASON_TEXT as Record<string, string>)[reason] ?? "Not sent";
}
