import { cn } from "@/lib/utils";
import type { PlanCalc } from "../../lib/plan";
import { gbp, parseMoney } from "../../lib/money";
import type { Plan } from "../../types";
import { TARGETS_CARD } from "../shared/targets-styles";
import { PlanInput } from "./plan-input";

interface StepBusinessProps {
  year: number;
  plan: Plan;
  calc: PlanCalc;
  onChange: (value: string) => void;
}

export function StepBusiness({ year, plan, calc, onChange }: StepBusinessProps) {
  const left = calc.numbers.business - calc.homeworkers;
  const parsed = parseMoney(plan.business);
  const invalid = !parsed.ok || calc.numbers.business < calc.homeworkers;
  const rows: Array<[string, string, string]> = [
    ["Already planned by homeworkers", gbp(calc.homeworkers), "They set their own targets"],
    ["Left to share between shops", calc.bizOk && left >= 0 ? gbp(left) : "–", "Business target less homeworkers"],
  ];
  return (
    <div>
      <div className="text-[13px] font-semibold">Business target {year}</div>
      <div className="mt-2 max-w-[360px]">
        <PlanInput value={plan.business} onChange={onChange} invalid={invalid} ariaLabel="Business target for the year" />
      </div>
      <p className="mb-5 mt-2 text-[12px] leading-relaxed text-social-muted">
        The profit the whole business is aiming for in {year}, homeworkers included. You will share it between shops and agents in the next steps.
      </p>
      <div className={cn(TARGETS_CARD, "px-4")}>
        {rows.map(([k, v, sub], i) => (
          <div key={k} className={cn("flex items-center justify-between gap-4 py-3.5", i > 0 && "border-t border-social-border")}>
            <div>
              <div className="text-[14px] font-medium">{k}</div>
              <div className="text-[12px] text-social-muted">{sub}</div>
            </div>
            <div className="text-[18px] font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
