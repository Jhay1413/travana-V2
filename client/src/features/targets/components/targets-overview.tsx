import { useState } from "react";
import { agentKey } from "../lib/allocation";
import { useLocation } from "wouter";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/hooks/use-toast";
import { useTargetsYear } from "../api/use-targets-queries";
import { canRunAllocation, visibleTabs } from "../lib/access";
import { profitSoFar } from "../lib/allocation";
import { TAB_LABEL, TAB_ORDER, tabPath, wizardPath, type TargetsTab } from "../lib/routes";
import { useTargetsSession } from "../state/use-targets-session";
import { useWizardDraft } from "../state/use-wizard-draft";
import type { AgentYear, HomeworkerYear } from "../types";
import { canEditAgentsIn } from "../lib/access";
import { AgentDrawer } from "./drawer/agent-drawer";
import { MonthsDialog, type MonthsSubject } from "./dialogs/months-dialog";
import { YearTargetDialog } from "./dialogs/year-target-dialog";
import { OverrideDrawer } from "./drawer/override-drawer";
import { DraftBanner } from "./header/draft-banner";
import { TargetsHeader } from "./header/targets-header";
import { TargetsEmpty, TargetsError, TargetsLoading } from "./shared/page-state";
import { AgentsTab } from "./tabs/agents-tab";
import { BusinessTab } from "./tabs/business-tab";
import { HomeworkersTab } from "./tabs/homeworkers-tab";
import { ShopsTab } from "./tabs/shops-tab";

type OpenDialog = { kind: "year" } | { kind: "months"; subject: MonthsSubject } | null;

interface TargetsOverviewProps {
  tab: TargetsTab;
  year: number;
}

/** /agency/targets: header, draft banner, the four level tabs and their editing dialogs. */
export function TargetsOverview({ tab, year }: TargetsOverviewProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { currentYear, orgId, userId } = useTargetsSession();
  const { data, isLoading, isError, refetch } = useTargetsYear(year);
  const draft = useWizardDraft(orgId, userId, year);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [homeworkerId, setHomeworkerId] = useState<string | null>(null);

  const go = (to: string) => navigate(to);
  const goYear = (y: number) => navigate(tabPath(tab, y, currentYear));
  const goWizard = (step?: number, branchId?: string | null) => navigate(wizardPath({ step, branchId, year, currentYear }));

  const tabs = data ? visibleTabs(TAB_ORDER, data.canEdit) : TAB_ORDER;
  const agent: AgentYear | null = data?.agents.find((a) => agentKey(a) === agentId) ?? null;
  const homeworker: HomeworkerYear | null = data?.homeworkers.find((h) => h.userId === homeworkerId) ?? null;
  const canAllocate = !!data && canRunAllocation(data.canEdit);

  return (
    <div className="min-w-0 space-y-5 text-[14px] leading-[1.5]" data-testid="section-targets">
      <TargetsHeader
        title="Targets"
        subtitle="Set targets for the business, each shop and each agent, and see how everyone is doing."
        year={year}
        currentYear={currentYear}
        onYear={goYear}
        onAllocate={canAllocate ? () => goWizard() : undefined}
      />

      {draft.draft && canAllocate && (
        <DraftBanner
          onResume={() => goWizard(draft.draft?.step)}
          onDiscard={() => {
            draft.discard();
            toast({ title: "Draft discarded" });
          }}
        />
      )}

      <Segmented
        value={tab}
        onChange={(t) => go(tabPath(t, year, currentYear))}
        label="Level"
        height={42}
        className="w-full max-w-[520px]"
        itemClassName="flex-1 justify-center"
        items={tabs.map((t) => ({ value: t, label: TAB_LABEL[t], testId: `targets-tab-${t}` }))}
      />

      {isLoading && <TargetsLoading />}
      {isError && <TargetsError onRetry={() => void refetch()} />}
      {data && (
        <>
          {tab === "business" && (
            <BusinessTab
              data={data}
              canEdit={data.canEdit.business}
              onEditYear={() => setDialog({ kind: "year" })}
              onEditMonths={() => setDialog({ kind: "months", subject: { kind: "business" } })}
              onChangeSplit={() => goWizard(2)}
            />
          )}
          {tab === "shops" && (
            <ShopsTab
              data={data}
              editableShopIds={data.canEdit.shopBranchIds}
              canAllocate={canAllocate}
              onEditMonths={(branchId) => setDialog({ kind: "months", subject: { kind: "shop", branchId } })}
              onEditAllocation={(branchId) => goWizard(3, branchId)}
            />
          )}
          {tab === "agents" && <AgentsTab data={data} onOpenAgent={(a) => setAgentId(agentKey(a))} />}
          {tab === "homeworkers" &&
            (data.canEdit.homeworkers ? (
              <HomeworkersTab data={data} onOverride={(h) => setHomeworkerId(h.userId)} />
            ) : (
              <TargetsEmpty title="Only the owner or an admin can see homeworker targets" />
            ))}

          {dialog?.kind === "year" && <YearTargetDialog year={year} months={data.business?.months ?? []} onClose={() => setDialog(null)} />}
          {dialog?.kind === "months" && (
            <MonthsDialog data={data} subject={dialog.subject} editableShopIds={data.canEdit.shopBranchIds} onClose={() => setDialog(null)} />
          )}
          <AgentDrawer
            data={data}
            agent={agent}
            editable={agent ? canEditAgentsIn(data.canEdit, agent.branchId) : false}
            profit={agent ? profitSoFar(agent.actual, data.currentMonth) : 0}
            onClose={() => setAgentId(null)}
          />
          <OverrideDrawer
            data={data}
            homeworker={homeworker}
            profit={homeworker ? profitSoFar(homeworker.actual, data.currentMonth) : 0}
            onClose={() => setHomeworkerId(null)}
          />
        </>
      )}
    </div>
  );
}
