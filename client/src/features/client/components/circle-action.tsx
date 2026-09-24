import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The client page's round blue action button (View / Share / Pin / +). Shared
 * by the client overview header and the quote / enquiry / booking detail
 * header so both action rows look the same.
 */
export function CircleAction({
  icon: Icon,
  label,
  onClick,
  href,
  active = false,
  size = "md",
  testId,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  /** Render as a link (opens in a new tab) instead of a button. */
  href?: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
  testId: string;
}) {
  const className = cn(
    "grid shrink-0 place-items-center rounded-full bg-[#07a9f4] text-white transition hover:bg-[#0596db]",
    size === "lg" ? "h-10 w-10" : size === "sm" ? "h-8 w-8" : "h-9 w-9",
    // Pinned (or otherwise "active") state gets a ring instead of a filled icon, so it stays
    // outline like every other action but is still visually distinguishable at a glance.
    active && "ring-2 ring-white ring-offset-1 ring-offset-[#07a9f4]",
  );
  const icon = <Icon className={cn(size === "lg" ? "h-5 w-5" : size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]")} strokeWidth={1.5} />;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label} className={className} data-testid={testId}>
        {icon}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active || undefined} className={className} data-testid={testId}>
      {icon}
    </button>
  );
}
