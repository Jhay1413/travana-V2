import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  /** Right-hand header control (link-style button / link). */
  action?: ReactNode;
  children: ReactNode;
  "data-testid"?: string;
}

export const SECTION_ACTION_CLASS = "text-[12px] font-medium text-social-orange-text hover:underline";

export function Section({ title, action, children, "data-testid": testId }: SectionProps) {
  return (
    <section className="border-t border-social-border px-5 py-4" data-testid={testId}>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-social-muted">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
