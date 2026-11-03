export type BadgeIcon = "star" | "check" | null;

export interface BadgeTone {
  label: string;
  /** Full Tailwind class names (bg + text) so the compiler keeps them. */
  className: string;
  icon: BadgeIcon;
}

/** Pill colours for the client type (`client.badge`); null when no badge is set. */
export function badgeTone(badge: string | null | undefined): BadgeTone | null {
  const label = badge?.trim();
  if (!label) return null;
  switch (label) {
    case "Repeat Client":
      return { label, className: "bg-avatar-sky-bg text-avatar-sky-fg", icon: "star" };
    case "New Client":
      return { label, className: "bg-avatar-green-bg text-avatar-green-fg", icon: "check" };
    case "VIP Client":
      return { label, className: "bg-ticket-amber-bg text-ticket-amber-fg", icon: null };
    case "Family Member":
      return { label, className: "bg-stage-quoted-bg text-stage-quoted-fg", icon: null };
    case "Time Waster":
    case "Banned":
      return { label, className: "bg-status-failed-bg text-status-failed-fg", icon: null };
    default:
      return { label, className: "bg-muted text-social-muted", icon: null };
  }
}
