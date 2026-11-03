import { useState } from "react";
import { agentKey } from "../lib/allocation";
import { useLocation, useSearch } from "wouter";
import { useTargetsYear } from "../api/use-targets-queries";
import { canEditAgentsIn } from "../lib/access";
import { profitSoFar } from "../lib/allocation";
import { BRANCH_TARGETS_PATH, parseYear } from "../lib/routes";
import { useTargetsSession } from "../state/use-targets-session";
import type { AgentYear } from "../types";
import { AgentDrawer } from "./drawer/agent-drawer";
import { TargetsHeader } from "./header/targets-header";
import { TargetsEmpty, TargetsError, TargetsLoading } from "./shared/page-state";
import { ShopCard } from "./shared/shop-card";
import { AgentsTab } from "./tabs/agents-tab";

/** /branch/targets: the branch manager's view. Their shop is read-only; agent targets in it can be changed. */
export function BranchTargetsPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { currentYear } = useTargetsSession();
  const year = parseYear(search, currentYear);
  const { data, isLoading, isError, refetch } = useTargetsYear(year);
  const [agentId, setAgentId] = useState<string | null>(null);

  const agent: AgentYear | null = data?.agents.find((a) => agentKey(a) === agentId) ?? null;

  return (
    <div className="min-w-0 space-y-5 text-[14px] leading-[1.5]" data-testid="section-branch-targets">
      <TargetsHeader
        title="Targets"
        subtitle="Your shop's target and how your agents are doing against theirs."
        year={year}
        currentYear={currentYear}
        onYear={(y) => navigate(y === currentYear ? BRANCH_TARGETS_PATH : `${BRANCH_TARGETS_PATH}?year=${y}`)}
      />
      {isLoading && <TargetsLoading />}
      {isError && <TargetsError onRetry={() => void refetch()} />}
      {data && data.branches.length === 0 && <TargetsEmpty title="No shop to show yet">You are not assigned to a shop with targets.</TargetsEmpty>}
      {data && data.branches.length > 0 && (
        <>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
            {data.branches.map((b, i) => (
              <ShopCard key={b.id} data={data} branch={b} index={i} />
            ))}
          </div>
          <p className="text-[12px] text-social-muted">The shop total is set by the Owner / Admin. You can change how it is shared between your agents.</p>
          <AgentsTab data={data} onOpenAgent={(a) => setAgentId(agentKey(a))} />
          <AgentDrawer
            data={data}
            agent={agent}
            editable={agent ? canEditAgentsIn(data.canEdit, agent.branchId) : false}
            profit={agent ? profitSoFar(agent.actual, data.currentMonth) : 0}
            onClose={() => setAgentId(null)}
          />
        </>
      )}
    </div>
  );
}
