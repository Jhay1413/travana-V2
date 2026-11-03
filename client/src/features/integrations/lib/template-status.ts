import type { PillTone } from "@/components/shared/status-pill";

export interface TemplateStatusInfo {
  label: string;
  tone: PillTone;
}

/** Pill label and colour for a Meta template status. Unknown values read as plain. */
export function templateStatus(status: string): TemplateStatusInfo {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return { label: "Approved", tone: "good" };
    case "PENDING":
      return { label: "Pending", tone: "warn" };
    case "REJECTED":
      return { label: "Rejected", tone: "bad" };
    case "PAUSED":
      return { label: "Paused", tone: "plain" };
    case "DISABLED":
      return { label: "Disabled", tone: "plain" };
    default:
      return { label: status, tone: "plain" };
  }
}

/** Truncates a template body for the list, adding an ellipsis when cut. */
export function truncateBody(body: string, max = 100): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}
