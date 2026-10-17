import type { BusinessType, Step } from "../types";

export const SINGLE_STEPS = ["Business details", "Invite team", "Done"] as const;
export const MULTI_STEPS = ["Head office", "Shops", "Team", "Done"] as const;

/** The stepper a business sees depends on whether it has one shop or several. */
export function stepperFor(
  businessType: BusinessType | null,
  step: Step,
): { steps: readonly string[]; current: number } {
  const multi = businessType === "multi";
  const steps = multi ? MULTI_STEPS : SINGLE_STEPS;
  let current = 0;
  if (step === "agents" || step === "agents-review" || step === "shops" || step === "shops-review") current = 1;
  if (step === "team" || step === "team-review") current = 2;
  if (step === "done") current = steps.length - 1;
  return { steps, current };
}

/** Where each already-finished stepper circle takes you when clicked. */
export function stepTarget(multi: boolean, index: number): Step | null {
  if (index === 0) return "business";
  if (multi) return index === 1 ? "shops" : index === 2 ? "team" : null;
  return index === 1 ? "agents" : null;
}

/** The screen a review step belongs to. */
export function reviewOrigin(step: Step): Step {
  if (step === "agents-review") return "agents";
  if (step === "shops-review") return "shops";
  if (step === "team-review") return "team";
  return step;
}
