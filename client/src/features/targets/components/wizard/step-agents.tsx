import { PersonAvatar } from "@/components/shared/person-avatar";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { agentKey, agentsOf } from "../../lib/allocation";
import type { PlanCalc } from "../../lib/plan";
import { gbp, moneyText } from "../../lib/money";
import { evenParts, shareProportionally, sum } from "../../lib/months";
import type { Plan, TargetsYear } from "../../types";
import { DriftMessage } from "../shared/drift-message";
import { TARGETS_CARD } from "../shared/targets-styles";
import { PlanInput } from "./plan-input";

interface StepAgentsProps {
  data: TargetsYear;
  plan: Plan;
  calc: PlanCalc;
  branchId: string;
  onBranch: (branchId: string) => void;
  onAgent: (userId: string, value: string) => void;
  onAgents: (values: Record<string, string>) => void;
}

const COLS = "grid grid-cols-[minmax(0,1.6fr)_minmax(150px,1fr)_64px_110px] items-center gap-3";
const pctOf = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");

export function StepAgents({ data, plan, calc, branchId, onBranch, onAgent, onAgents }: StepAgentsProps) {
  const row = calc.shopRows.find((r) => r.branchId === branchId);
  const list = agentsOf(data, branchId);
  // Inactive people keep what they have; only active agents share the rest.
  const sharing = list.filter((a) => !a.inactive);
  const locked = sum(list.filter((a) => a.inactive).map((a) => calc.numbers.agents[agentKey(a)] ?? 0));

  if (!row) return <div className="py-8 text-center text-[14px] text-social-muted">There are no shops to share targets between yet.</div>;

  const evenly = () => {
    const parts = evenParts(Math.max(0, row.target - locked), sharing.length);
    onAgents(Object.fromEntries(sharing.map((a, i) => [agentKey(a), moneyText(parts[i])])));
  };
  const keepShares = () => {
    const current = sharing.map((a) => calc.numbers.agents[agentKey(a)] ?? 0);
    const total = sum(current);
    const room = Math.max(0, row.target - locked);
    if (total <= 0) return evenly();
    const next = shareProportionally(room, current);
    onAgents(Object.fromEntries(sharing.map((a, i) => [agentKey(a), moneyText(next[i])])));
  };

  return (
    <div>
      {data.branches.length > 1 && (
        <Segmented
          value={branchId}
          onChange={onBranch}
          label="Shop"
          className="mb-5 max-w-full overflow-x-auto"
          items={data.branches.map((b) => {
            const r = calc.shopRows.find((q) => q.branchId === b.id);
            return {
              value: b.id,
              testId: `wizard-shop-tab-${b.id}`,
              label: (
                <>
                  {b.name}
                  {r && !r.done && <span title="Does not add up yet" aria-label="does not add up yet" className="h-1.5 w-1.5 rounded-full bg-stage-lost-dot" />}
                </>
              ),
            };
          })}
        />
      )}

      <div className={cn(TARGETS_CARD, "mb-5 flex flex-wrap items-center justify-between gap-4 bg-muted/40 px-4 py-4")}>
        <div>
          <div className="text-[12px] text-social-muted">{row.name} shop target</div>
          <div className="mt-0.5 text-[26px] font-semibold tabular-nums" data-testid="wizard-shop-target">
            {gbp(row.target)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-social-muted">Allocated to agents</div>
          <div className="text-[20px] font-semibold tabular-nums" data-testid="wizard-shop-allocated">
            {gbp(row.sum)}
          </div>
          <DriftMessage drift={row.drift} />
        </div>
      </div>

      {list.length === 0 ? (
        <div className="py-7 text-center text-[14px] text-social-muted">No agents in {row.name} yet, so there is nothing to share out here.</div>
      ) : (
        <>
          <div className={cn(COLS, "pb-2 pr-1 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted")}>
            <div className="pl-12">Agent</div>
            <div>Yearly target</div>
            <div className="text-right">Share</div>
            <div className="text-right">Average a month</div>
          </div>
          {list.map((a) => {
            const v = calc.numbers.agents[agentKey(a)] ?? 0;
            return (
              <div key={agentKey(a)} data-testid={`wizard-agent-row-${agentKey(a)}`} className={cn(COLS, "py-1.5 pr-1")}>
                <div className="flex min-w-0 items-center gap-3 text-[14px]">
                  <PersonAvatar name={a.name} size={36} />
                  <span className="truncate">{a.name}</span>
                  {a.inactive && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-social-muted">Inactive</span>}
                </div>
                <PlanInput value={plan.agents[agentKey(a)] ?? ""} onChange={(x) => onAgent(agentKey(a), x)} invalid={calc.agentFieldErrors.includes(agentKey(a))} disabled={a.inactive} ariaLabel={`${a.name} yearly target`} />
                <div className="text-right text-[14px] font-semibold tabular-nums">{pctOf(v, row.target)}</div>
                <div className="text-right text-[14px] tabular-nums text-social-muted">{gbp(Math.round(v / 12))}</div>
              </div>
            );
          })}
          <div className="mt-2.5 flex flex-wrap gap-5 pl-12">
            <button type="button" onClick={evenly} className="text-[14px] font-semibold text-social-orange-text hover:underline" data-testid="button-split-evenly-agents">
              Split evenly across agents
            </button>
            {row.drift !== 0 && (
              <button type="button" onClick={keepShares} className="text-[14px] font-semibold text-social-orange-text hover:underline" data-testid="button-keep-shares">
                Keep each person&apos;s share
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
