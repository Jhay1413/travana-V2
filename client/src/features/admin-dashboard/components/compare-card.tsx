import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeCard } from "@/features/agent-overview/components/home/home-ui";
import { useCompare } from "../api/use-compare";
import { PERIOD_OPTIONS, againstOptions, compareSentence } from "../lib/compare-copy";
import type { CompareAgainst, ComparePeriod } from "../types";
import { CompareTable } from "./compare-table";
import { CardHead, CardNote } from "./shared/bits";

export function CompareCard({ branchId, className }: { branchId?: string; className?: string }) {
  const [period, setPeriod] = useState<ComparePeriod>("month");
  const [against, setAgainst] = useState<CompareAgainst>("prev");
  const { data, isLoading, isError, isPlaceholderData } = useCompare({ period, against, branchId });

  const changePeriod = (next: ComparePeriod) => {
    setPeriod(next);
    setAgainst("prev");
  };

  return (
    <HomeCard className={`flex flex-col ${className ?? ""}`} testId="card-compare">
      <CardHead
        id="compare-title"
        title="Compare with earlier periods"
        right={
          <Segmented<ComparePeriod>
            value={period}
            onChange={changePeriod}
            variant="black"
            label="Period"
            items={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label, testId: `segment-compare-period-${o.value}` }))}
          />
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-social-muted xl:text-[13px]">Compare with</span>
        <Segmented<CompareAgainst>
          value={against}
          onChange={setAgainst}
          variant="black"
          label="Compare with"
          items={againstOptions(period).map((o) => ({ value: o.value, label: o.label, testId: `segment-compare-against-${o.value}` }))}
        />
      </div>

      {isLoading && !data ? (
        <div className="space-y-2" data-testid="compare-loading">
          <Skeleton className="h-5 w-3/4" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <CardNote tone="error" testId="compare-error">
          The comparison isn't available right now. Try again in a moment.
        </CardNote>
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={isPlaceholderData}>
          <p className="mb-3 text-[13px] font-medium xl:text-[14px]" role="status" data-testid="text-compare-sentence">
            {compareSentence(data.period, data.now.profit, data.other.profit, data.labels.other)}
          </p>
          <CompareTable data={data} />
        </div>
      )}
    </HomeCard>
  );
}
