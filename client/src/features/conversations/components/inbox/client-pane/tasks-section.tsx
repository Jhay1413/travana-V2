import { useCurrentUser } from "@/hooks/queries";
import { useClientTaskCreate } from "@/features/client";
import { CreateTaskDialog, useTasks } from "@/features/tasks";
import { Section, SECTION_ACTION_CLASS } from "./section";
import { taskDueLabel } from "./task-due";

interface TasksSectionProps {
  clientId: string;
  firstName: string;
}

const MAX_TASKS = 3;

export function TasksSection({ clientId, firstName }: TasksSectionProps) {
  const { data: currentUser } = useCurrentUser();
  const taskCreate = useClientTaskCreate();
  const { data: tasks } = useTasks("client", clientId);
  const open = (tasks ?? []).filter((t) => !t.completed).slice(0, MAX_TASKS);
  const now = new Date();
  return (
    <Section
      title="Tasks"
      data-testid="client-tasks"
      action={
        <button
          type="button"
          className={SECTION_ACTION_CLASS}
          onClick={() => taskCreate.setShowTaskDialog(true)}
          data-testid="conversation-create-task"
        >
          Add
        </button>
      }
    >
      {open.length === 0 ? (
        <p className="text-[13px] text-social-muted">No open tasks for {firstName}</p>
      ) : (
        <div className="space-y-2">
          {open.map((t) => (
            <div key={t.id}>
              <div className="truncate text-[13px] font-medium">{t.title || "Untitled task"}</div>
              <div className="text-[12px] text-social-muted">{taskDueLabel(t, now)}</div>
            </div>
          ))}
        </div>
      )}
      <CreateTaskDialog
        presentation="drawer"
        open={taskCreate.showTaskDialog}
        onOpenChange={taskCreate.setShowTaskDialog}
        entityType="client"
        entityId={clientId}
        defaultAssignedToId={currentUser?.id}
      />
    </Section>
  );
}
