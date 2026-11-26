/** How the staff side words what a customer did with a quote (public page or customer portal). */

export interface CustomerActionLike {
  actionType: string;
  message?: string | null;
  reason?: string | null;
  wantsSimilar?: boolean | null;
}

/** Short heading for one customer action. */
export function customerActionLabel(type: string): string {
  switch (type) {
    case "accepted":
      return "Accepted the quote";
    case "changes_requested":
      return "Asked for changes";
    case "declined":
      return "Not interested";
    case "reopened":
      return "Changed their mind";
    default:
      return type;
  }
}

/** The extra line under a decline: the reason, and whether they asked for something similar. Empty for other actions. */
export function customerActionDetail(a: CustomerActionLike): string {
  if (a.actionType !== "declined") return "";
  const parts: string[] = [];
  parts.push(a.reason ? `Reason: ${a.reason}` : "No reason given");
  if (a.wantsSimilar) parts.push("Wants something similar");
  return parts.join(" · ");
}

/** True for the actions that are good news, so they can be shown in green. */
export function isPositiveCustomerAction(type: string): boolean {
  return type === "accepted" || type === "reopened";
}
