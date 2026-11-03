import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/** White card with the redesigned header: 16px title on the left, an optional slot on the right. */
export function HomeCard({
  title,
  right,
  children,
  className,
  testId,
  titleTestId,
  compact = false,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
  titleTestId?: string;
  /** 20px padding instead of 22px (Pipeline Live!). */
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-social-border bg-card",
        compact ? "p-4 xl:p-5" : "p-4 xl:p-[22px]",
        className,
      )}
      data-testid={testId}
    >
      {title != null && (
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold xl:text-base" data-testid={titleTestId}>
            {title}
          </h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const LINK_CLASS = "text-[12px] font-semibold text-social-orange-text hover:underline xl:text-[13px]";

/** Small orange text link used in card headers and footers. */
export function HomeLink({
  href,
  children,
  testId,
  className,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn(LINK_CLASS, className)} data-testid={testId}>
      {children}
    </Link>
  );
}

export function EmptyLine({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="py-3.5 text-[12px] text-social-muted xl:text-[13px]" data-testid={testId}>
      {children}
    </div>
  );
}

/** Rounded status pill with caller-supplied colours. */
export function HomePill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-[3px] text-[11px] font-semibold xl:text-[12px]",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Moved to components/shared; re-exported so existing imports keep working.
export { PersonAvatar, nameInitials } from "@/components/shared/person-avatar";
export { UnderlineTabs } from "@/components/shared/underline-tabs";
export { RowButton } from "@/components/shared/row-button";
