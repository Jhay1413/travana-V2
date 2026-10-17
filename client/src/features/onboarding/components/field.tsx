import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ERROR_TEXT } from "./styles";

interface FieldProps {
  label: string;
  /** id of the control. The label points at it. */
  id: string;
  error?: string | undefined;
  hint?: ReactNode;
  /** The control isn't a native form element (segmented control), so the label can't `for` it. */
  labelOnly?: boolean;
  /** Small link or text under the control, e.g. "Use a different email". */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, the way every form field in the wizard is laid out. */
export function Field({ label, id, error, hint, labelOnly, action, className, children }: FieldProps) {
  return (
    <div className={cn("relative min-w-0 space-y-1.5", className)}>
      <Label id={`${id}-label`} htmlFor={labelOnly ? undefined : id} className="text-[13px] font-semibold">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className={ERROR_TEXT}>
          {error}
        </p>
      ) : hint ? (
        <span className="block text-[11px] text-social-muted">{hint}</span>
      ) : null}
      {action}
    </div>
  );
}
