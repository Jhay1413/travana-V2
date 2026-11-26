import { useState } from "react";
import { cn } from "@/lib/utils";

/** Strips non-digits first, then keeps at most four (so a pasted "12ab34567" gives 1234, not 12). */
export function sanitisePin(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

/**
 * A 4-digit PIN field with a show/hide toggle. The input is an underlined serif field in the
 * portal style; `autoComplete` defaults to "current-password" (sign-in) and should be
 * "new-password" when choosing a PIN.
 */
export function PinField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  testId,
  toggleTestId,
  describedBy,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (pin: string) => void;
  autoComplete?: "current-password" | "new-password";
  testId?: string;
  toggleTestId?: string;
  describedBy?: string;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="portal-caps-label">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Hide PIN" : "Show PIN"}
          className="min-h-11 px-1 text-[11px] font-medium uppercase tracking-[0.2em] portal-text-amber-ink"
          data-testid={toggleTestId}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <input
        id={id}
        type={show ? "text" : "password"}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        placeholder="4 digits"
        value={value}
        onChange={(e) => onChange(sanitisePin(e.target.value))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "portal-serif flex min-h-12 w-full rounded-none border-0 border-b border-input bg-transparent px-0 text-[26px] tracking-[0.4em] text-foreground transition-colors placeholder:text-[16px] placeholder:tracking-normal focus-visible:border-accent focus-visible:outline-none",
          invalid && "border-destructive",
        )}
        data-testid={testId}
      />
    </div>
  );
}
