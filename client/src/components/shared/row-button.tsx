import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Full-width clickable row (link semantics, keyboard accessible). */
export function RowButton({
  onActivate,
  children,
  className,
  testId,
}: {
  onActivate: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      className={cn(
        "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-social-orange focus-visible:ring-offset-2 rounded-lg",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
