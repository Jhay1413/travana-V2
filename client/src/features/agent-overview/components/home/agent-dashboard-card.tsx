import { useState } from "react";
import { omitHomeworkerDeniedTabs } from "@/config/homeworker-access";
import { TasksTab } from "../tasks-tab";
import { TicketsTab } from "../tickets-tab";
import { ConversationsTab } from "../conversations-tab";
import { MyCoursesTab } from "../my-courses-tab";
import { NotesTab } from "../notes-tab";
import { HomeCard, UnderlineTabs } from "./home-ui";

type DashboardTab = "tasks" | "tickets" | "conversations" | "my-courses" | "notes";

const DASHBOARD_TABS: Array<{ value: DashboardTab; label: string }> = [
  { value: "tasks", label: "Tasks" },
  { value: "tickets", label: "Tickets" },
  { value: "conversations", label: "Latest Inbox" },
  { value: "my-courses", label: "My Courses" },
  // Label is "Goals" (renamed from "Notes"); the "notes" value is kept as-is
  // since it isn't persisted or referenced elsewhere.
  { value: "notes", label: "Goals" },
];

/** The "Agent Dashboard" card: orange New Task button and Tasks / Tickets / Inbox / Courses / Goals tabs. */
export function AgentDashboardCard({
  userId,
  isHomeworker,
  monthProfit,
  monthTarget,
  onNewTask,
}: {
  userId: string;
  isHomeworker: boolean;
  monthProfit: number;
  monthTarget: number;
  onNewTask: () => void;
}) {
  const [tab, setTab] = useState<DashboardTab>("tasks");
  const tabs = omitHomeworkerDeniedTabs(DASHBOARD_TABS, isHomeworker, ["conversations"]);

  return (
    <HomeCard
      title="Agent Dashboard"
      titleTestId="text-overview-title"
      testId="card-agent-dashboard"
      right={
        <button
          type="button"
          onClick={onNewTask}
          className="h-8 shrink-0 rounded-lg bg-social-orange px-3.5 text-[12px] font-semibold text-slate-900 transition hover:bg-social-orange/90 xl:text-[13px]"
          aria-label="New task"
          data-testid="button-dashboard-add"
        >
          + New Task
        </button>
      }
    >
      <UnderlineTabs tabs={tabs} value={tab} onChange={setTab} label="Agent dashboard sections" testIdPrefix="tab-overview" />
      {tab === "tasks" && <TasksTab userId={userId} />}
      {tab === "tickets" && <TicketsTab userId={userId} />}
      {tab === "conversations" && !isHomeworker && <ConversationsTab />}
      {tab === "my-courses" && <MyCoursesTab />}
      {tab === "notes" && <NotesTab monthProfit={monthProfit} target={monthTarget} />}
    </HomeCard>
  );
}
