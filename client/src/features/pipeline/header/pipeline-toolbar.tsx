import { LayoutList, Trello } from "lucide-react";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import type { PipelineCounts, PipelineQuick } from "@/features/transaction";
import type { PipelineScope, PipelineView } from "@/features/pipeline/state/use-pipeline-filters";
import { PipelineSegmented } from "@/features/pipeline/shared/pipeline-segmented";
import { QuickChips } from "./quick-chips";

interface PipelineToolbarProps {
  embedded: boolean;
  view: PipelineView;
  onViewChange: (v: PipelineView) => void;
  scope: PipelineScope;
  onScopeChange: (v: PipelineScope) => void;
  selectedAgentId: string;
  onSelectedAgentIdChange: (v: string) => void;
  quick: PipelineQuick | null;
  onQuickChange: (v: PipelineQuick | null) => void;
  counts: PipelineCounts | undefined;
}

/** Second header row: Board/List and My/All side by side, a divider, then the quick chips. */
export function PipelineToolbar({
  embedded,
  view,
  onViewChange,
  scope,
  onScopeChange,
  selectedAgentId,
  onSelectedAgentIdChange,
  quick,
  onQuickChange,
  counts,
}: PipelineToolbarProps) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-3">
      <PipelineSegmented
        label="Switch view"
        value={view}
        onChange={onViewChange}
        items={[
          { value: "board", label: "Board", icon: <Trello className="h-4 w-4" />, testId: "pipeline-view-tab-board" },
          { value: "list", label: "List", icon: <LayoutList className="h-4 w-4" />, testId: "pipeline-view-tab-list" },
        ]}
      />
      {!embedded && (
        <>
          <PipelineSegmented
            label="Deal owner"
            value={scope}
            onChange={onScopeChange}
            items={[
              { value: "mine", label: "My Deals", testId: "pipeline-deals-tab-mine" },
              { value: "all", label: "All Deals", testId: "pipeline-deals-tab-all" },
            ]}
          />
          {/* The agent picker only makes sense while looking at everyone's
              deals; My Deals is locked to the current user. */}
          {scope === "all" && (
            <UserReassignSelect
              value={selectedAgentId}
              onValueChange={onSelectedAgentIdChange}
              allowAll
              allLabel="All Agents"
              className="w-[180px]"
              data-testid="select-agent-filter"
            />
          )}
          <span className="mx-1 hidden h-[26px] w-px bg-social-border md:block" />
          <QuickChips value={quick} counts={counts} onChange={onQuickChange} />
        </>
      )}
    </div>
  );
}
