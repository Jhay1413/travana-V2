import type { ReactNode } from "react";

export interface FormSectionProps {
  /** DOM id; also the scroll-spy / side-nav key. */
  id: string;
  title: string;
  icon?: ReactNode;
  /** Right side of the section heading. */
  right?: ReactNode;
  "data-testid"?: string;
  children: ReactNode;
}

/** White rounded section card (reference "Sec"). */
export function FormSection({ id, title, icon, right, "data-testid": testId, children }: FormSectionProps) {
  return (
    <section id={id} className="fm-sec" data-testid={testId} aria-labelledby={`${id}-title`}>
      <h3 className="fm-sec__h">
        <span>
          {icon ? <span className="fm-sec__ic">{icon}</span> : null}
          <span id={`${id}-title`}>{title}</span>
        </span>
        {right}
      </h3>
      {children}
    </section>
  );
}
