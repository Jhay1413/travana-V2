import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pill toggle used for quick chips and the filter popover; black when active. */
export function FilterChip({
  active,
  onClick,
  children,
  className,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors xl:px-3.5 xl:text-[13px]",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-social-border bg-card text-social-muted hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
