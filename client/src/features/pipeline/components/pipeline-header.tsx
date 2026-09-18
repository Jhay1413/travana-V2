import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { SegmentedTabs } from "@/features/agent-overview/components/dashboard-ui";

export type PipelineViewMode = "board" | "list";

interface PipelineHeaderProps {
  embedded: boolean;
  viewMode: PipelineViewMode;
  onViewModeChange: (v: PipelineViewMode) => void;
  activeFilter: "all" | "mine";
  onActiveFilterChange: (v: "all" | "mine") => void;
  selectedAgentId: string;
  onSelectedAgentIdChange: (v: string) => void;
}

/** Board header: title, view-mode segmented control, My/All Deals segmented
 *  control, and — while looking at everyone's deals — the agent dropdown. */
export function PipelineHeader({
  embedded,
  viewMode,
  onViewModeChange,
  activeFilter,
  onActiveFilterChange,
  selectedAgentId,
  onSelectedAgentIdChange,
}: PipelineHeaderProps) {
  const viewTabs: Array<{ value: PipelineViewMode; label: string }> = [
    { value: "board", label: "Board View" },
    { value: "list", label: "List View" },
  ];

  return (
    // No box of its own — the header sits directly on the page background.
    <div className="shrink-0">
      <div className={embedded ? undefined : "px-4 pt-4 md:px-6 md:pt-6"}>
        {!embedded && (
          <h2
            className="mb-2 text-sm font-semibold 3xl:text-base"
            data-testid="pipeline-title"
          >
            Pipeline
          </h2>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            tabs={viewTabs}
            value={viewMode}
            onChange={onViewModeChange}
            testIdPrefix="pipeline-view-tab"
            accent="black"
          />
          {!embedded && (
            <>
              <SegmentedTabs
                tabs={[
                  { value: "mine", label: "My Deals" },
                  { value: "all", label: "All Deals" },
                ]}
                value={activeFilter}
                onChange={onActiveFilterChange}
                testIdPrefix="pipeline-deals-tab"
                accent="black"
              />
              {/* The agent picker only makes sense while looking at everyone's
                  deals; My Deals is locked to the current user. */}
              {activeFilter === "all" && (
                <UserReassignSelect
                  value={selectedAgentId}
                  onValueChange={onSelectedAgentIdChange}
                  allowAll
                  allLabel="All Agents"
                  className="w-[180px]"
                  data-testid="select-agent-filter"
                />
              )}
            </>
          )}
        </div>
      </div>
      <div className="py-3">
        <div className="border-b border-black/10" />
      </div>
    </div>
  );
}
