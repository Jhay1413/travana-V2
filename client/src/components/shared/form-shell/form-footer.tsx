import type { ReactNode } from "react";

export interface FormFooterProps {
  /** Left side: status text, toggles (test checkbox...). */
  status?: ReactNode;
  /** Right side: buttons. */
  children: ReactNode;
}

/** Pop-up footer bar: status/toggles on the left, buttons on the right. */
export function FormFooter({ status, children }: FormFooterProps) {
  return (
    <div className="fm-foot">
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", minWidth: 0, fontSize: 13 }}>{status}</div>
      <div className="fm-foot__btns">{children}</div>
    </div>
  );
}
