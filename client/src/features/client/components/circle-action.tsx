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
  size?: "md" | "lg";
  testId: string;
}) {
  const className = cn(
    "grid shrink-0 place-items-center rounded-full bg-[#07a9f4] text-white transition hover:bg-[#0596db]",
    size === "lg" ? "h-10 w-10" : "h-9 w-9",
  );
  const icon = <Icon className={cn(size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]", active && "fill-current")} strokeWidth={1.5} />;

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
