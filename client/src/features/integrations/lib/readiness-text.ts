import type { PurposeReadiness, ReadinessReason } from "../types";

/** Plain words for why a message type is not going out. */
export function readinessReasonText(reason: ReadinessReason): string {
  switch (reason) {
    case "switched_off":
      return "switched off";
    case "not_connected":
      return "WhatsApp isn't connected";
    case "unreachable":
      return "WhatsApp couldn't be reached";
    case "no_channel":
      return "no WhatsApp number is ready to send";
    case "no_template":
      return "no template chosen";
    case "org_suspended":
      return "this agency is suspended";
    case "database_update_needed":
      return "waiting for a database update";
    case "template_missing":
      return "the chosen template no longer exists";
    case "template_not_approved":
      return "template no longer approved";
    case "mapping_mismatch":
      return "the template changed, so its placeholders need setting again";
    case "sms_not_configured":
      return "text messaging isn't set up";
  }
}

export type ReadinessTone = "ready" | "not_sent" | "off";

export function readinessTone(r: PurposeReadiness | undefined): ReadinessTone | null {
  if (!r) return null;
  if (r.ready) return "ready";
  return r.reason === "switched_off" ? "off" : "not_sent";
}
