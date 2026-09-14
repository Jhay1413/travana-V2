import { Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { SegmentedTabs } from "@/features/agent-overview/components/dashboard-ui";

export type PipelineViewMode = "board" | "list";
type ViewTabValue = PipelineViewMode | "filters";

const QUOTE_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "quoted", label: "Quoted" },
  { value: "in_play", label: "In Play" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" },
];

interface PipelineHeaderProps {
  embedded: boolean;
  viewMode: PipelineViewMode;
  onViewModeChange: (v: PipelineViewMode) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilter: "all" | "mine";
  onActiveFilterChange: (v: "all" | "mine") => void;
  quoteStatusFilter: string;
  onQuoteStatusChange: (v: string) => void;
  selectedAgentId: string;
  onSelectedAgentIdChange: (v: string) => void;
}

/** Board header: title, view-mode/filters segmented control, My/All Deals
 *  segmented control, and the collapsible filter row underneath. */
export function PipelineHeader({
  embedded,
  viewMode,
  onViewModeChange,
  showFilters,
  onToggleFilters,
  activeFilter,
  onActiveFilterChange,
  quoteStatusFilter,
  onQuoteStatusChange,
  selectedAgentId,
  onSelectedAgentIdChange,
}: PipelineHeaderProps) {
  const segValue: ViewTabValue = showFilters ? "filters" : viewMode;
  const handleSegChange = (v: ViewTabValue) => {
    if (v === "filters") {
      onToggleFilters();
      return;
    }
    onViewModeChange(v);
  };

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
          <SegmentedTabs<ViewTabValue>
            tabs={[
              { value: "board", label: "Board View" },
              { value: "list", label: "List View" },
              { value: "filters", label: "Filters" },
            ]}
            value={segValue}
            onChange={handleSegChange}
            testIdPrefix="pipeline-view-tab"
            accent="black"
          />
          {!embedded && (
            <SegmentedTabs<"all" | "mine">
              tabs={[
                { value: "mine", label: "My Deals" },
                { value: "all", label: "All Deals" },
              ]}
              value={activeFilter}
              onChange={onActiveFilterChange}
              testIdPrefix="pipeline-deals-tab"
              accent="black"
            />
          )}
        </div>

        {showFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Select
              value={quoteStatusFilter}
              onValueChange={onQuoteStatusChange}
            >
              <SelectTrigger
                className="h-8 w-[180px] rounded-lg border-black/10 bg-white text-xs"
                data-testid="select-quote-status"
              >
                <Filter className="mr-1.5 h-3.5 w-3.5 opacity-60" />
                <SelectValue placeholder="Quote Status" />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_STATUS_OPTIONS.map((o) => (
                  <SelectItem
                    key={o.value}
                    value={o.value}
                    data-testid={`select-quote-status-${o.value}`}
                  >
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!embedded && activeFilter === "all" && (
              <UserReassignSelect
                value={selectedAgentId}
                onValueChange={onSelectedAgentIdChange}
                allowAll
                allLabel="All Agents"
                className="w-[180px]"
                data-testid="select-agent-filter"
              />
            )}
          </div>
        )}
      </div>
      <div className="py-3">
        <div className="border-b border-black/10" />
      </div>
    </div>
  );
}
