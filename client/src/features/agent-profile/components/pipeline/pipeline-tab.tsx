import { ExpiringQuotesSection } from "@/features/agent-overview";
import { PipelineBoard } from "@/features/pipeline";

/**
 * The agent's own deals on the standard pipeline board (drag, convert, open a deal), plus their
 * quotes that are about to expire. The tab is only mounted while open, so nothing loads before.
 */
export function PipelineTab({ userId }: { userId: string }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_320px]" data-testid="agent-profile-pipeline">
      <div className="min-w-0">
        <PipelineBoard agentId={userId} embedded hideBooked />
      </div>
      <ExpiringQuotesSection userId={userId} tab="pipeline" />
    </div>
  );
}
