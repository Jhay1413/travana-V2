import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useClientQuoteViews } from "@/features/quote";
import { useRoles } from "@/hooks/use-role";
import { omitHomeworkerDeniedTabs } from "@/config/homeworker-access";
import type { Ticket as ApiTicket } from "@/features/tickets/types";
import type { User as ApiUser } from "@/features/user/types";
import type { TaskNew } from "@shared/schema";
import type { ClientFileItem, DealLabelLookup, HolidaySelection } from "@/features/client/types";
import { CLIENT_TABS, resolveClientTab, type ClientTabKey } from "@/features/client/lib/client-tabs";
import { totalViews } from "@/features/client/lib/task-rows";
import type { TaskHolidayInfo } from "@/features/client/lib/deal-labels";
import { ClientNotesList } from "@/features/client/components/client-notes-list";
import { ClientChatsTab } from "@/features/client/components/tabs/ClientChatsTab";
import { ClientFilesTab } from "@/features/client/components/tabs/ClientFilesTab";
import { ClientTicketsTab } from "@/features/client/components/tabs/ClientTicketsTab";
import { ClientVipClubTab } from "@/features/client/components/tabs/ClientVipClubTab";
import { CARD_CLASS, CardHead } from "./card-head";
import { TasksTab } from "./tasks-tab";
import { ViewsTab } from "./views-tab";

interface ClientDashboardCardProps {
  clientId: string;
  clientName: string;
  role: string;
  readOnly: boolean;
  tasks: TaskNew[];
  users: ApiUser[];
  taskHolidays: Map<string, TaskHolidayInfo>;
  dealLabels: DealLabelLookup;
  rawTickets: ApiTicket[];
  clientFiles: ClientFileItem[];
  onAddTask: () => void;
  onNewTicket: () => void;
  onUploadFile: () => void;
  onDeleteFile: (id: string) => void;
  onOpenDeal: (selection: HolidaySelection) => void;
  onOpenTicket: (ticketId: string) => void;
  onViewAllTasks: () => void;
}

/** "{name} Dashboard": Tasks, Notes, Chats, Tickets, Files, Views (with count) and VIP. */
export function ClientDashboardCard({
  clientId,
  clientName,
  role,
  readOnly,
  tasks,
  users,
  taskHolidays,
  dealLabels,
  rawTickets,
  clientFiles,
  onAddTask,
  onNewTicket,
  onUploadFile,
  onDeleteFile,
  onOpenDeal,
  onOpenTicket,
  onViewAllTasks,
}: ClientDashboardCardProps) {
  const [tab, setTab] = useState<ClientTabKey>(() => resolveClientTab(window.location.search));
  const { hasRole } = useRoles();
  const isHomeworker = hasRole("homeworker");

  // Total times the client has opened any quote - the badge on the Views tab.
  const { data: quoteViews } = useClientQuoteViews(clientId);
  const viewCount = useMemo(() => totalViews(quoteViews), [quoteViews]);

  const items = useMemo(
    () =>
      omitHomeworkerDeniedTabs(CLIENT_TABS, isHomeworker, ["chats"]).map((t) => ({
        value: t.value,
        label: t.label,
        count: t.value === "views" && viewCount > 0 ? viewCount : undefined,
        testId: `client-index-tab-${t.value}`,
      })),
    [isHomeworker, viewCount],
  );

  // A homeworker deep-linked to ?tab=chats falls back to Tasks.
  const activeTab: ClientTabKey = items.some((i) => i.value === tab) ? tab : "tasks";

  return (
    <section className={`${CARD_CLASS} min-h-[300px]`} data-testid="client-index-tabs-card">
      <CardHead
        title={`${clientName} Dashboard`}
        testId="client-index-dashboard-title"
        right={
          readOnly ? undefined : (
            <Button type="button" variant="outline" className="h-10 shrink-0 rounded-[10px] px-5 text-[13px] font-semibold" onClick={onAddTask} data-testid="client-index-add-task">
              Add Task
            </Button>
          )
        }
      />
      <div className="overflow-x-auto pb-1">
        <Segmented
          value={activeTab}
          onChange={setTab}
          items={items}
          height={42}
          label="Client dashboard sections"
          className="w-full min-w-[440px]"
          itemClassName="flex-1 px-2"
        />
      </div>

      <div className="mt-2" data-testid={`client-index-tab-panel-${activeTab}`}>
        {activeTab === "tasks" && (
          <TasksTab clientId={clientId} tasks={tasks} users={users} holidays={taskHolidays} readOnly={readOnly} onViewAll={onViewAllTasks} />
        )}
        {activeTab === "notes" && (
          <ClientNotesList clientId={clientId} users={users} dealsByTransactionId={dealLabels} onOpenDeal={onOpenDeal} readOnly={readOnly} />
        )}
        {activeTab === "chats" && !isHomeworker && <ClientChatsTab clientId={clientId} />}
        {activeTab === "tickets" && (
          <ClientTicketsTab tickets={rawTickets} users={users} onNewTicket={readOnly ? undefined : onNewTicket} onOpenTicket={onOpenTicket} />
        )}
        {activeTab === "files" && (
          <ClientFilesTab clientFiles={clientFiles} onDeleteFile={onDeleteFile} onUploadFile={onUploadFile} role={role} readOnly={readOnly} />
        )}
        {activeTab === "views" && <ViewsTab clientId={clientId} onOpenDeal={onOpenDeal} />}
        {activeTab === "club-vip" && <ClientVipClubTab clientId={clientId} />}
      </div>
    </section>
  );
}
