import type { ReactNode } from "react";

export interface FieldProps {
  label: string;
  /** Id of the control, wires the label. */
  htmlFor?: string;
  /** Muted hint after the label, e.g. "(optional)". */
  hint?: string;
  /** Small slot next to the label (e.g. a source chip). */
  chip?: ReactNode;
  error?: string;
  /** Test id for the error paragraph. */
  errorTestId?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + error message. */
export function Field({ label, htmlFor, hint, chip, error, errorTestId, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label className="fm-label" htmlFor={htmlFor}>
        {label}
        {hint ? <small> {hint}</small> : null}
        {chip ? <span className="fm-chip-slot">{chip}</span> : null}
      </label>
      {children}
      {error ? (
        <p className="fm-err" role="alert" data-testid={errorTestId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
