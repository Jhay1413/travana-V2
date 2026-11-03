import type { OperatorSummary } from "../lib/summary";
import { CARD } from "./classes";

function Cell({ label, value, sub, testId }: { label: string; value: string | number; sub: string; testId: string }) {
  return (
    <div className="min-w-0 flex-1 basis-[180px] px-2" data-testid={testId}>
      <div className="text-[12px] font-semibold uppercase tracking-[.06em] text-social-muted">{label}</div>
      <div className="mt-1 text-[26px] font-semibold leading-tight tabular-nums">{value}</div>
      <div className="truncate text-[13px] text-social-muted">{sub}</div>
    </div>
  );
}

/** Three figures above the list: how many, the average rate, the best rate. */
export function SummaryStrip({ summary }: { summary: OperatorSummary }) {
  return (
    <section aria-label="Summary" className={`${CARD} flex-row flex-wrap gap-y-4 py-4 xl:py-4`}>
      <Cell label="Tour operators" value={summary.count} sub="In your list" testId="summary-count" />
      <Cell label="Average commission" value={summary.average === "—" ? "—" : `${summary.average}%`} sub="Across all operators" testId="summary-average" />
      <Cell label="Highest commission" value={summary.highest} sub={summary.highestName} testId="summary-highest" />
    </section>
  );
}
