import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "navy" | "orange" | "plain" | "sky" | "indigo";

const TONES: Record<Tone, string> = {
  navy: "bg-social-navy text-white hover:bg-social-navy-ink",
  orange: "bg-social-orange text-slate-900 hover:bg-social-orange-text hover:text-white",
  plain: "border border-social-border bg-card text-foreground hover:bg-muted",
  sky: "bg-[#0EA5E9] text-white hover:bg-[#0284C7]",
  indigo: "bg-[#4F46E5] text-white hover:bg-[#4338CA]",
};

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: Tone;
  size?: 36 | 40;
  active?: boolean;
  children: ReactNode;
}

/** Circular icon button used in the client header and the Live deals rail. */
export const RoundButton = forwardRef<HTMLButtonElement, RoundButtonProps>(function RoundButton(
  { label, tone = "navy", size = 40, active, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition disabled:opacity-50",
        size === 36 ? "h-9 w-9" : "h-10 w-10",
        TONES[tone],
        active && "ring-[3px] ring-social-orange/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
