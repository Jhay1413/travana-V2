import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProps {
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Called with the index of a finished step that was clicked. */
  onStepClick?: (index: number) => void;
}

export function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <ol aria-label="Progress" className="m-0 mb-6 flex list-none items-center p-0">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const circle = (
          <span
            className={cn(
              "grid size-7 flex-none place-items-center rounded-full text-[12px] font-semibold",
              done && "bg-status-posted-fg text-white",
              active && "bg-social-orange text-slate-900",
              !done && !active && "border-[1.5px] border-social-border text-social-muted",
            )}
          >
            {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
        );
        const text = (
          <span className={cn("text-[13px] font-semibold", active ? "text-foreground" : "text-social-muted")}>
            {label}
          </span>
        );
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("flex items-center", i < steps.length - 1 && "flex-1")}
          >
            {done && onStepClick ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                aria-label={`Go back to ${label}`}
                className="flex items-center gap-2.5"
              >
                {circle}
                {text}
              </button>
            ) : (
              <span className="flex items-center gap-2.5">
                {circle}
                {text}
              </span>
            )}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn("mx-3 h-px min-w-6 flex-1", done ? "bg-status-posted-fg" : "bg-social-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
