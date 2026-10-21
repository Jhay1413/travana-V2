import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useNotes, useTasks, useTicketsByClient } from "@/hooks/queries";
import { useRoles } from "@/hooks/use-role";
import { groupNotesByParent } from "@/features/note/lib/group-notes";
import { ClientConversationBox } from "@/features/client/components/tabs/ClientChatsTab";
import { HolidayNotesTab } from "@/features/client/components/holiday-notes-tab";
import { HolidayTasksTab } from "@/features/client/components/holiday-tasks-tab";
import { HolidayComposer } from "@/features/client/components/holiday-composer";
import { HolidayTicketsTab } from "@/features/client/components/holiday-tickets-tab";
import { activityTabs, defaultActivityTab, type ActivityTab } from "@/features/client/lib/activity-tabs";
import { NewTaskAction, RaiseTicketAction } from "@/features/client/components/holiday/activity-actions";
import { HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

export interface ActivityCardProps {
  transactionId: string;
  entityId: string;
  entityType: "enquiry" | "quote" | "booking";
  clientId: string;
  clientName: string;
  readOnly: boolean;
}

/** Messages, notes, tasks and tickets for one holiday, as underline tabs with count badges. */
export function ActivityCard({ transactionId, entityId, entityType, clientId, clientName, readOnly }: ActivityCardProps) {
  const { hasRole } = useRoles();
  const tabs = useMemo(
    () => activityTabs({ isHomeworker: hasRole("homeworker"), hasClient: !!clientId, readOnly }),
    [hasRole, clientId, readOnly],
  );
  const [picked, setPicked] = useState<ActivityTab | null>(null);
  const tab: ActivityTab = picked && tabs.some((t) => t.value === picked) ? picked : defaultActivityTab(tabs);

  // Booking tasks are stored under the "quote" entity type.
  const taskEntityType = entityType === "booking" ? "quote" : entityType;
  const { data: notes } = useNotes(transactionId);
  const { data: tasks } = useTasks(taskEntityType, entityId);
  const { data: tickets } = useTicketsByClient(clientId);

  const counts: Partial<Record<ActivityTab, number>> = {
    notes: notes ? groupNotesByParent(notes).topLevel.filter((n) => n.description !== "system").length : undefined,
    tasks: tasks ? tasks.filter((t) => !t.completed).length : undefined,
    tickets: tickets ? tickets.filter((t) => !!transactionId && t.transactionId === transactionId).length : undefined,
  };

  return (
    <section className={HOLIDAY_CARD} aria-label="Messages, notes, tasks and tickets" id="holiday-activity" data-testid="holiday-activity-card">
      <div role="tablist" aria-label="Activity" className="relative -mt-1 mb-4 flex gap-1 overflow-x-auto border-b border-social-border">
        {tabs.map((t) => {
          const selected = t.value === tab;
          const count = counts[t.value];
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setPicked(t.value)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-[10px] border-b-[3px] px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                selected ? "border-social-navy text-social-navy" : "border-transparent text-qp-muted hover:text-foreground",
              )}
              data-testid={`holiday-activity-tab-${t.value}`}
            >
              {t.label}
              {count !== undefined && (
                <span className="rounded-full bg-muted px-[7px] text-[11px] font-semibold text-qp-muted">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={tabs.find((t) => t.value === tab)?.label}>
        {tab === "messages" && <ClientConversationBox clientId={clientId} />}

        {tab === "notes" && (
          <>
            <HolidayNotesTab transactionId={transactionId} readOnly={readOnly} />
            {!readOnly && (
              <div className="mt-4">
                <HolidayComposer transactionId={transactionId} variant="note" />
              </div>
            )}
          </>
        )}

        {tab === "tasks" && (
          <>
            {!readOnly && (
              <div className="mb-1 flex justify-end">
                <NewTaskAction entityType={entityType} entityId={entityId} />
              </div>
            )}
            <HolidayTasksTab entityId={entityId} entityType={entityType} readOnly={readOnly} hideCreateButton />
          </>
        )}

        {tab === "tickets" && !readOnly && !!clientId && (
          <>
            <div className="mb-1 flex justify-end">
              <RaiseTicketAction clientId={clientId} clientName={clientName} transactionId={transactionId} />
            </div>
            <HolidayTicketsTab clientId={clientId} clientName={clientName} entityId={entityId} entityType={entityType} transactionId={transactionId} hideCreateButton />
          </>
        )}
      </div>
    </section>
  );
}
