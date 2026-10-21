import type { Transaction } from "@/features/quote/types";
import { NextTaskRow } from "@/components/shared/next-task-row";
import { nextTaskRowProps } from "@/features/pipeline/lib/deal-meta";

/** Next-task row on a card: thin wrapper mapping a transaction onto the shared NextTaskRow. */
export function DealCardTask({ transaction: t, onAddTask }: { transaction: Transaction; onAddTask: () => void }) {
  return (
    <NextTaskRow
      {...nextTaskRowProps(t.next_task)}
      onAddTask={onAddTask}
      testId={`next-task-${t.id}`}
    />
  );
}
