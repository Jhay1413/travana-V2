import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_LABELS, type StepNo } from "../../lib/plan";

interface WizardStepperProps {
  step: StepNo;
  /** Furthest step the numbers allow; later steps are not clickable. */
  reach: StepNo;
  onGo: (step: StepNo) => void;
}

export function WizardStepper({ step, reach, onGo }: WizardStepperProps) {
  return (
    <nav aria-label="Allocation steps" className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="wizard-stepper">
      {STEP_LABELS.map((label, i) => {
        const no = (i + 1) as StepNo;
        const done = no < step;
        const active = no === step;
        const canGo = !active && no <= reach;
        const dot = (
          <span
            className={cn(
              "grid h-6 w-6 place-items-center rounded-full border text-[12px] font-semibold",
              active && "border-social-orange bg-social-orange text-[#1F2937]",
              done && "border-status-scheduled-fg bg-status-scheduled-fg text-white",
              !active && !done && "border-social-border bg-card text-social-muted",
            )}
          >
            {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : no}
          </span>
        );
        const text = <span className={cn("text-[13px] font-semibold", active ? "text-foreground" : "text-social-muted")}>{label}</span>;
        return (
          <div key={label} className="flex items-center gap-3">
            {canGo ? (
              <button type="button" onClick={() => onGo(no)} className="flex items-center gap-2" aria-label={`Go to step ${no}, ${label}`} data-testid={`stepper-${no}`}>
                {dot}
                {text}
              </button>
            ) : (
              <span className="flex items-center gap-2" aria-current={active ? "step" : undefined} data-testid={`stepper-${no}`}>
                {dot}
                {text}
              </span>
            )}
            {no < STEP_LABELS.length && <span className={cn("h-px w-8 sm:w-12", done ? "bg-status-scheduled-fg" : "bg-social-border")} />}
          </div>
        );
      })}
    </nav>
  );
}
