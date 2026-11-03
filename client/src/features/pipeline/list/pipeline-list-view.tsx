import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/features/quote/types";
import { ALL_STAGES, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import type { ColumnData } from "@/features/pipeline/state/use-pipeline-columns";
import { ListGroup } from "./list-group";
import { LIST_GRID_COLS, LIST_HEADERS } from "./list-columns";

const DEFAULT_OPEN: Record<PipelineStage, boolean> = {
  Enquiry: true,
  Quoted: true,
  "In Play": true,
  Booked: true,
  Future: false,
  Lost: false,
};

/** List view: one rounded card grouped by stage, rows 52px, no checkboxes. */
export function PipelineListView({
  columns,
  stages,
  isLoading,
  selectedId,
  getClientName,
  onRowClick,
  onAddTask,
}: {
  columns: Record<PipelineStage, ColumnData>;
  stages: PipelineStage[];
  isLoading: boolean;
  selectedId: string | null;
  getClientName: (id: string | null) => string;
  onRowClick: (t: Transaction, stage: PipelineStage) => void;
  onAddTask: (t: Transaction, stage: PipelineStage) => void;
}) {
  if (isLoading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  const shown = ALL_STAGES.filter((s) => stages.includes(s) && (columns[s].total > 0 || DEFAULT_OPEN[s]));
  const empty = shown.every((s) => columns[s].total === 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-pipeline-card-border bg-card">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex min-h-0 min-w-[1180px] flex-1 flex-col" role="table" aria-label="Deals" data-testid="pipeline-list-table">
          <div className="grid h-10 flex-none items-center gap-3.5 border-b border-pipeline-card-border bg-card px-[18px]" role="row" style={{ gridTemplateColumns: LIST_GRID_COLS }}>
            {LIST_HEADERS.map((label) => (
              <div
                key={label}
                role="columnheader"
                className={cn("text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted", (label === "Cost" || label === "Profit") && "text-right")}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {shown.map((stage) => (
              <ListGroup
                key={stage}
                stage={stage}
                column={columns[stage]}
                defaultOpen={DEFAULT_OPEN[stage]}
                selectedId={selectedId}
                getClientName={getClientName}
                onOpen={onRowClick}
                onAddTask={onAddTask}
              />
            ))}
            {empty && <div className="p-10 text-center text-social-muted">No deals match.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
