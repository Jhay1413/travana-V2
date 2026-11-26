import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** The portal's underlined serif text field with a small caps label. */
export function PortalField({
  id,
  label,
  className,
  invalid,
  ...props
}: { id: string; label: string; invalid?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="portal-caps-label">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(
          "portal-serif flex min-h-12 w-full rounded-none border-0 border-b border-input bg-transparent px-0 text-[22px] text-foreground transition-colors focus-visible:border-accent focus-visible:outline-none",
          invalid && "border-destructive",
          className,
        )}
        {...props}
      />
    </div>
  );
}
