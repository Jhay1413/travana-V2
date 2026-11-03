import { Button } from "@/components/ui/button";
import { agentKey } from "../../lib/allocation";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { OUTLINE_ACTION } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { agentsOf, profitSoFar, shopDrift } from "../../lib/allocation";
import { shopSwatch } from "../../lib/chart";
import { gbp } from "../../lib/money";
import { sum } from "../../lib/months";
import { paceStatus, percentOf } from "../../lib/status";
import type { BranchYear, TargetsYear } from "../../types";
import { DriftMessage } from "./drift-message";
import { ProgressBar } from "./progress-bar";
import { StatusPill } from "./status-pill";
import { TARGETS_CARD } from "./targets-styles";

interface ShopCardProps {
  data: TargetsYear;
  branch: BranchYear;
  /** Position in the branch list; picks the swatch colour. */
  index: number;
  onEditAllocation?: () => void;
  onEditMonths?: () => void;
}

/** One shop: profit against its target, how its agents share it, and (when allowed) edit buttons. */
export function ShopCard({ data, branch, index, onEditAllocation, onEditMonths }: ShopCardProps) {
  const target = sum(branch.months);
  const profit = profitSoFar(branch.actual, data.currentMonth);
  const status = paceStatus(profit, target, data.elapsed);
  const agents = agentsOf(data, branch.id);
  return (
    <section className={cn(TARGETS_CARD, "p-4 xl:p-5")} aria-label={`${branch.name} shop`} data-testid={`shop-card-${branch.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-3 w-3 shrink-0 rounded-[3px]", shopSwatch(index))} />
          <h2 className="truncate text-[15px] font-semibold">{branch.name}</h2>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="mt-3 text-[26px] font-semibold leading-tight tabular-nums">
        {gbp(profit)} <span className="text-[14px] font-medium text-social-muted">of {gbp(target)}</span>
      </div>
      <ProgressBar className="mb-1 mt-2.5" profit={profit} target={target} elapsed={data.elapsed} />
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[12px] text-social-muted">
        {percentOf(profit, target)}% of the year target · <DriftMessage drift={shopDrift(data, branch.id)} short />
      </div>
      {agents.map((a) => {
        const t = sum(a.months);
        const p = profitSoFar(a.actual, data.currentMonth);
        return (
          <div key={agentKey(a)} className="flex items-center gap-2.5 border-t border-social-border py-2">
            <PersonAvatar name={a.name} size={28} />
            <div className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.name}</div>
            <ProgressBar thin className="w-[70px]" profit={p} target={t} elapsed={data.elapsed} />
            <span className="w-16 text-right text-[12px] tabular-nums text-social-muted">{gbp(t)}</span>
          </div>
        );
      })}
      {(onEditAllocation || onEditMonths) && (
        <div className="mt-3.5 flex gap-2">
          {onEditAllocation && (
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 flex-1 px-3")} onClick={onEditAllocation} aria-label={`Edit allocation for ${branch.name}`}>
              Edit allocation
            </Button>
          )}
          {onEditMonths && (
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 flex-1 px-3")} onClick={onEditMonths} aria-label={`Edit months for ${branch.name}`}>
              Edit months
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
