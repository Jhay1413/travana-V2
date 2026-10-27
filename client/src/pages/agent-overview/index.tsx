import { useState } from "react";
import { useRole, useRoles } from "@/hooks/use-role";
import { MyHomeworkerBranchCard } from "@/features/homeworkers";
import { useCurrentUser } from "@/hooks/queries";
import { AddTaskModal } from "@/components/shared/add-task-modal";
import { ProfitStatBoxes } from "@/features/agent-overview/components/profit-stat-boxes";
import { AgentDashboardCard } from "@/features/agent-overview/components/home/agent-dashboard-card";
import { EngagementSection } from "@/features/agent-overview/components/engagement-section";
import { PipelineSection } from "@/features/agent-overview/components/pipeline-section";
import { NewsSection } from "@/features/agent-overview/components/news-section";
import { PipelineLivePanel } from "@/features/agent-overview/components/pipeline-live-panel";
import { greetingLine } from "@/features/agent-overview/lib/greeting";
import { targetHrefForRole } from "@/features/agent-overview/lib/target-link";
import { useProfitStats } from "@/features/agent-overview/lib/use-profit-stats";

// Tiles share the main column with Pipeline Live! from xl, so they wrap to 3 + 2 until 2xl.
const TILE_GRID = "grid-cols-2 md:grid-cols-3 2xl:grid-cols-5";

export default function AgentOverviewPage() {
  const [creatingTask, setCreatingTask] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const { hasRole } = useRoles();
  const { orgRole } = useRole();
  const isHomeworker = hasRole("homeworker");
  const profitStats = useProfitStats();

  // The agent dashboard is a personal view, so the sales target always reflects
  // the current user's own target — even for org admins and branch managers, who
  // would otherwise see the branch/agency target here.
  const userId = currentUser?.id || "";
  const firstName = currentUser?.firstName || currentUser?.name?.split(/\s+/)[0] || "";

  return (
    <div className="text-compact -m-4 min-h-full bg-social-page p-4 md:-m-6 md:p-6">
      <h1 className="mb-3.5 text-[13px] font-normal text-social-muted xl:text-[14px]" data-testid="text-greeting">
        {greetingLine(new Date(), firstName)}
      </h1>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <section className="min-w-0 flex-1 space-y-5">
          <ProfitStatBoxes
            profitStats={profitStats}
            isAgentView
            targetHref={targetHrefForRole(orgRole)}
            className={TILE_GRID}
          />

          {isHomeworker && <MyHomeworkerBranchCard />}

          <div className="grid min-w-0 gap-5 lg:grid-cols-[1.5fr_1fr]">
            <AgentDashboardCard
              userId={userId}
              isHomeworker={isHomeworker}
              monthProfit={profitStats.monthProfit}
              monthTarget={profitStats.agentSalesTarget}
              onNewTask={() => setCreatingTask(true)}
            />
            <EngagementSection />
          </div>

          <div className="grid min-w-0 gap-5 lg:grid-cols-[1.5fr_1fr]">
            <PipelineSection userId={userId} />
            <NewsSection />
          </div>
        </section>

        {/* Live feed of the user's newest enquiries, quotes and bookings: a 382px column from xl, stacked below that. */}
        <PipelineLivePanel
          userId={userId}
          className="w-full shrink-0 rounded-2xl border border-social-border bg-card py-4 xl:w-[382px] xl:py-5"
        />
      </div>

      <AddTaskModal
        title="New task"
        open={creatingTask}
        onOpenChange={setCreatingTask}
        defaultAssignedToId={userId || undefined}
        successToast="Task created"
        testIdPrefix="dashboard-new-task"
      />
    </div>
  );
}
