import { useCurrentUser } from "@/hooks/queries";
import { useClientTaskCreate } from "@/features/client";
import { TaskPriorityPill, useTasks } from "@/features/tasks";
import { AddTaskModal } from "@/components/shared/add-task-modal";
import { NextTaskRow } from "@/components/shared/next-task-row";
import { Section, SECTION_ACTION_CLASS } from "./section";
import { dueDateIso, sortByDue, taskDueLabel } from "./task-due";

interface TasksSectionProps {
  clientId: string;
  firstName: string;
}

const MAX_TASKS = 3;

export function TasksSection({ clientId, firstName }: TasksSectionProps) {
  const { data: currentUser } = useCurrentUser();
  const taskCreate = useClientTaskCreate();
  const { data: tasks } = useTasks("client", clientId);
  const open = sortByDue((tasks ?? []).filter((t) => !t.completed)).slice(0, MAX_TASKS);
  const [next, ...rest] = open;
  const now = new Date();
  const openDialog = () => taskCreate.setShowTaskDialog(true);
  return (
    <Section
      title="Tasks"
      data-testid="client-tasks"
      action={
        <button type="button" className={SECTION_ACTION_CLASS} onClick={openDialog} data-testid="conversation-create-task">
          Add
        </button>
      }
    >
      <div className="space-y-2.5">
        <NextTaskRow
          title={next ? next.title || "Untitled task" : null}
          dueDate={next ? dueDateIso(next.dueDate) : null}
          priority={next?.priority}
          size="card"
          onAddTask={openDialog}
          testId="client-next-task"
        />
        {rest.map((t) => (
          <div key={t.id}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 truncate text-[13px] font-medium">{t.title || "Untitled task"}</div>
              <TaskPriorityPill priority={t.priority} />
            </div>
            <div className="text-[12px] text-social-muted">{taskDueLabel(t, now)}</div>
          </div>
        ))}
      </div>
      <AddTaskModal
        title={`Add a task for ${firstName}`}
        subtitle="It shows in your Tasks list on the day it is due."
        placeholder="e.g. Send three Lanzarote options"
        successToast={`Task added for ${firstName}`}
        open={taskCreate.showTaskDialog}
        onOpenChange={taskCreate.setShowTaskDialog}
        entityType="client"
        entityId={clientId}
        defaultAssignedToId={currentUser?.id}
        testIdPrefix="inbox-add-task"
      />
    </Section>
  );
}
