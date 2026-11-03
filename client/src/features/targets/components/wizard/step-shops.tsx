import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentsOf } from "../../lib/allocation";
import type { PlanCalc } from "../../lib/plan";
import { HOMEWORKER_SWATCH, shopSwatch } from "../../lib/chart";
import { gbp } from "../../lib/money";
import type { Plan, TargetsYear } from "../../types";
import { AllocBar } from "../shared/alloc-bar";
import { DriftMessage } from "../shared/drift-message";
import { TARGETS_CARD } from "../shared/targets-styles";
import { PlanInput } from "./plan-input";

interface StepShopsProps {
  data: TargetsYear;
  plan: Plan;
  calc: PlanCalc;
  onShop: (branchId: string, value: string) => void;
  onChangeBusiness: () => void;
}

const COLS = "grid grid-cols-[minmax(0,1.6fr)_minmax(150px,1fr)_64px_56px] items-center gap-3";
const pctOf = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "–");

export function StepShops({ data, plan, calc, onShop, onChangeBusiness }: StepShopsProps) {
  const total = calc.numbers.business;
  const slices = [
    ...data.branches.map((b, i) => ({ name: b.name, value: calc.numbers.shops[b.id] ?? 0, colour: shopSwatch(i) })),
    { name: "Homeworkers", value: calc.homeworkers, colour: HOMEWORKER_SWATCH },
  ];
  return (
    <div>
      <div className={cn(TARGETS_CARD, "mb-5 flex items-center justify-between gap-3 bg-muted/40 px-4 py-4")}>
        <div>
          <div className="text-[12px] text-social-muted">Business target {data.year} (from step 1)</div>
          <div className="mt-0.5 text-[26px] font-semibold tabular-nums" data-testid="wizard-business">
            {gbp(total)}
          </div>
        </div>
        <button type="button" onClick={onChangeBusiness} className="text-[14px] font-semibold text-social-orange-text hover:underline">
          Change
        </button>
      </div>

      <AllocBar slices={slices} total={total} />

      <div className="mt-5">
        <div className={cn(COLS, "pb-2 pl-4 pr-1 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted")}>
          <div>Shop</div>
          <div>Yearly target</div>
          <div className="text-right">Share</div>
          <div className="text-right">Agents</div>
        </div>
        {data.branches.map((b, i) => (
          <div key={b.id} data-testid={`wizard-shop-row-${b.id}`} className={cn(COLS, "py-1.5 pl-4 pr-1")}>
            <div className="flex min-w-0 items-center gap-2.5 text-[14px] font-semibold">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", shopSwatch(i))} />
              <span className="truncate">{b.name}</span>
            </div>
            <PlanInput value={plan.shops[b.id] ?? ""} onChange={(v) => onShop(b.id, v)} invalid={calc.shopFieldErrors.includes(b.id)} ariaLabel={`${b.name} yearly target`} />
            <div className="text-right text-[14px] font-semibold tabular-nums">{pctOf(calc.numbers.shops[b.id] ?? 0, total)}</div>
            <div className="text-right text-[14px] text-social-muted">{agentsOf(data, b.id).length}</div>
          </div>
        ))}
        <div className={cn(COLS, "mt-1.5 rounded-xl bg-rose-50 py-2.5 pl-4 pr-1 dark:bg-rose-950/30")} data-testid="wizard-homeworkers-row">
          <div>
            <div className="flex items-center gap-2.5 text-[14px] font-semibold">
              <span className={cn("h-2.5 w-2.5 rounded-[3px]", HOMEWORKER_SWATCH)} />
              Homeworkers
            </div>
            <div className="ml-5 text-[12px] text-social-muted">They set their own targets, so this is read only</div>
          </div>
          <div className="flex h-10 items-center rounded-[10px] border border-social-border bg-muted px-3 text-[14px] tabular-nums text-social-muted" aria-label="Homeworkers total, read only">
            £{calc.homeworkers.toLocaleString("en-GB")}
          </div>
          <div className="text-right text-[14px] font-semibold tabular-nums">{pctOf(calc.homeworkers, total)}</div>
          <div className="flex justify-end">
            <Lock className="h-3.5 w-3.5 text-social-muted" />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[15px] font-semibold" data-testid="wizard-allocated">
          Allocated {gbp(calc.shopsSum + calc.homeworkers)} of {gbp(total)}
        </div>
        <DriftMessage drift={calc.shopsDrift} />
      </div>
    </div>
  );
}
