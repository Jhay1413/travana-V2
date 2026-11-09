import type { ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";

export type FormButtonTone = "default" | "primary" | "navy";

export interface FormButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** default = white, primary = amber, navy = dark blue. */
  tone?: FormButtonTone;
  small?: boolean;
}

/** Footer / header action button (type="button" unless overridden). */
export function FormButton({ tone = "default", small, className, type = "button", ...rest }: FormButtonProps) {
  const cls = ["fm-btn", tone !== "default" ? `fm-btn--${tone}` : "", small ? "fm-btn--sm" : "", className ?? ""].filter(Boolean).join(" ");
  return <button type={type} className={cls} {...rest} />;
}

/** Round close (X) button for the head's right slot. */
export function FormCloseButton({ label = "Close", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }) {
  return (
    <button type="button" className="fm-x" aria-label={label} {...rest}>
      <X size={18} aria-hidden="true" />
    </button>
  );
}

/** Text-style amber link button. */
export function FormLinkButton({ className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`fm-link${className ? ` ${className}` : ""}`} {...rest} />;
}
