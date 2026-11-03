import { LayoutList, Trello } from "lucide-react";
import { PipelineSegmented } from "@/features/pipeline/shared/pipeline-segmented";
import type { QueueView } from "../../lib/queue-prefs";
import type { QueueChip, QueueCounts, QueueScope } from "../../lib/ticket-queue";
import { QueueChips } from "./queue-chips";

interface QueueToolbarProps {
  view: QueueView;
  onViewChange: (v: QueueView) => void;
  scope: QueueScope;
  onScopeChange: (v: QueueScope) => void;
  canViewAll: boolean;
  chip: QueueChip;
  onChipChange: (v: QueueChip) => void;
  counts: QueueCounts;
}

/** Second header row: List/Board and the scope side by side, a divider, then the count chips. */
export function QueueToolbar({ view, onViewChange, scope, onScopeChange, canViewAll, chip, onChipChange, counts }: QueueToolbarProps) {
  const scopeItems = [
    { value: "mine" as const, label: "My tickets", testId: "ticket-scope-mine" },
    { value: "raised" as const, label: "Raised by me", testId: "ticket-scope-raised" },
    ...(canViewAll ? [{ value: "all" as const, label: "All tickets", testId: "ticket-scope-all" }] : []),
  ];
  return (
    <div className="flex flex-none flex-wrap items-center gap-3">
      <PipelineSegmented
        label="Switch view"
        value={view}
        onChange={onViewChange}
        items={[
          { value: "list", label: "List", icon: <LayoutList className="h-4 w-4" />, testId: "ticket-view-list" },
          { value: "board", label: "Board", icon: <Trello className="h-4 w-4" />, testId: "ticket-view-board" },
        ]}
      />
      <PipelineSegmented label="Ticket owner" value={scope} onChange={onScopeChange} items={scopeItems} />
      <span className="mx-1 hidden h-[26px] w-px bg-social-border md:block" />
      <QueueChips value={chip} counts={counts} onChange={onChipChange} />
    </div>
  );
}
