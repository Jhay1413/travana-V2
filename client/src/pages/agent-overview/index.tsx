import { useMemo, useState } from "react";
import { SquarePlus } from "lucide-react";
import {
  useAgentStats,
  useCurrentUser,
} from "@/hooks/queries";
import {
  useShopTargets,
  useAgentTargetsByUserId,
} from "@/features/reports/api/use-targets-queries";
import { CreateTaskDialog } from "@/features/tasks/components/tasks/CreateTaskDialog";
import { ProfitStatBoxes, type ProfitStats } from "@/features/agent-overview/components/profit-stat-boxes";
import { DashboardCard, SegmentedTabs } from "@/features/agent-overview/components/dashboard-ui";
import { TasksTab } from "@/features/agent-overview/components/tasks-tab";
import { TicketsTab } from "@/features/agent-overview/components/tickets-tab";
import { ConversationsTab } from "@/features/agent-overview/components/conversations-tab";
import { MyCoursesTab } from "@/features/agent-overview/components/my-courses-tab";
import { NotesTab } from "@/features/agent-overview/components/notes-tab";
import { EngagementSection } from "@/features/agent-overview/components/engagement-section";
import { PipelineSection } from "@/features/agent-overview/components/pipeline-section";
import { NewsSection } from "@/features/agent-overview/components/news-section";
import { PipelineLivePanel } from "@/features/agent-overview/components/pipeline-live-panel";

type DashboardTab = "tasks" | "tickets" | "conversations" | "my-courses" | "notes";

const DASHBOARD_TABS: Array<{ value: DashboardTab; label: string }> = [
  { value: "tasks", label: "Tasks" },
  { value: "tickets", label: "Tickets" },
  { value: "conversations", label: "Conversations" },
  { value: "my-courses", label: "My Courses" },
  { value: "notes", label: "Notes" },
];

export default function AgentOverviewPage() {
  const [tab, setTab] = useState<DashboardTab>("tasks");
  const [creatingTask, setCreatingTask] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const { data: shopTargetsData } = useShopTargets();
  const { data: agentTargetsData } = useAgentTargetsByUserId(currentUser?.id || "");
  const { data: agentStats } = useAgentStats({ enabled: !!currentUser?.id });

  const profitStats: ProfitStats = useMemo(() => {
    const now = new Date();
    const currentMonthTarget = shopTargetsData?.find(
      (t: any) => t.year === now.getFullYear() && t.month === now.getMonth() + 1,
    );
    const salesTarget = currentMonthTarget
      ? parseFloat(currentMonthTarget.targetAmount) || 0
      : 0;
    const currentAgentTarget = agentTargetsData?.find(
      (t: any) => t.year === now.getFullYear() && t.month === now.getMonth() + 1,
    );
    const agentSalesTarget = currentAgentTarget
      ? parseFloat(currentAgentTarget.targetAmount) || 0
      : 0;
    return {
      todayProfit: agentStats?.todayProfit ?? 0,
      weekProfit: agentStats?.weekProfit ?? 0,
      monthProfit: agentStats?.monthProfit ?? 0,
      salesTarget,
      agentSalesTarget,
      avgBookingValue: agentStats?.avgBookingValue ?? 0,
      totalOpenQuotesValue: agentStats?.totalOpenQuotesValue ?? 0,
      bookingsCount: agentStats?.bookingsCount ?? 0,
      quotesCount: agentStats?.quotesCount ?? 0,
    };
  }, [agentStats, shopTargetsData, agentTargetsData]);

  // The agent dashboard is a personal view, so the sales target always reflects
  // the current user's own target — even for org admins and branch managers, who
  // would otherwise see the branch/agency target here.
  const isAgentView = true;
  const userId = currentUser?.id || "";

  return (
    <div className="flex gap-6">
      <section className="min-w-0 flex-1 space-y-4">
        <ProfitStatBoxes profitStats={profitStats} isAgentView={isAgentView} />

        <div className="grid gap-4 min-w-0 xl:grid-cols-[1.55fr_.7fr]">
          <DashboardCard className="min-w-0" testId="card-agent-dashboard">
            <div className="flex items-start justify-between gap-2">
              <div className="text-base font-semibold" data-testid="text-overview-title">
                Agent Dashboard
              </div>
              <button
                type="button"
                onClick={() => setCreatingTask(true)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-black/15 text-black/60 transition hover:bg-black/5 hover:text-black dark:border-white/20 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Add task"
                data-testid="button-dashboard-add"
              >
                <SquarePlus className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <SegmentedTabs
                tabs={DASHBOARD_TABS}
                value={tab}
                onChange={setTab}
                testIdPrefix="tab-overview"
              />
            </div>

            <div className="mt-4">
              {tab === "tasks" && <TasksTab userId={userId} />}
              {tab === "tickets" && <TicketsTab userId={userId} />}
              {tab === "conversations" && <ConversationsTab />}
              {tab === "my-courses" && <MyCoursesTab />}
              {tab === "notes" && <NotesTab />}
            </div>
          </DashboardCard>

          <EngagementSection />
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1.15fr]">
          <PipelineSection userId={userId} />
          <NewsSection />
        </div>
      </section>

      {/* Live feed of the user's newest enquiries, quotes and bookings.
          Negative margins cancel the content panel's p-6 so the left border
          runs the full height (and the panel reaches the right edge). */}
      <PipelineLivePanel
        userId={userId}
        className="hidden w-[320px] shrink-0 border-l border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.04] 2xl:block 2xl:-my-6 2xl:-mr-6 2xl:py-6"
      />

      <CreateTaskDialog
        open={creatingTask}
        onOpenChange={setCreatingTask}
        defaultAssignedToId={userId}
      />
    </div>
  );
}
