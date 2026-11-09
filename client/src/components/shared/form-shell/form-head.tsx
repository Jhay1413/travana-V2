import type { ReactNode } from "react";

export interface FormHeadProps {
  /** Icon node shown in the amber tile. */
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** Right-hand slot (import button, close button...). */
  right?: ReactNode;
}

/** Pop-up header: icon tile, title + subtitle, right slot. */
export function FormHead({ icon, title, subtitle, right }: FormHeadProps) {
  return (
    <div className="fm-head">
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        {icon ? <span className="fm-head__ic">{icon}</span> : null}
        <div style={{ minWidth: 0 }}>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{right}</div> : null}
    </div>
  );
}
