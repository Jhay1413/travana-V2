import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeCard } from "@/features/agent-overview/components/home/home-ui";
import { useProfitSources } from "../api/use-profit-sources";
import { gbp, plural } from "../lib/money";
import { barWidth, maxOf, share, sortSources, sourceTile, type SourceMeasure } from "../lib/sources-math";
import { CardHead, CardNote, InitialsTile, RankBar } from "./shared/bits";

export function SourcesCard({ branchId, className }: { branchId?: string; className?: string }) {
  const [by, setBy] = useState<SourceMeasure>("profit");
  const { data, isLoading, isError } = useProfitSources(branchId);

  const rows = data ? sortSources(data.rows, by) : [];
  const total = data ? data.totals[by] : 0;
  const top = data ? maxOf(data.rows, by) : 0;

  return (
    <HomeCard className={`flex flex-col ${className ?? ""}`} testId="card-profit-sources">
      <CardHead
        id="sources-title"
        title="Where profit comes from"
        sub="This month, by where the enquiry came from"
        right={
          <Segmented
            value={by}
            onChange={setBy}
            variant="black"
            label="Measure sources by"
            items={[
              { value: "profit", label: "Profit", testId: "segment-sources-profit" },
              { value: "bookings", label: "Bookings", testId: "segment-sources-bookings" },
            ]}
          />
        }
      />

      {isLoading ? (
        <div className="space-y-3" data-testid="sources-loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <CardNote tone="error" testId="sources-error">
          Profit sources aren't available right now. Try again in a moment.
        </CardNote>
      ) : rows.length === 0 ? (
        <CardNote testId="sources-empty">No bookings this month.</CardNote>
      ) : (
        <ul>
          {rows.map((r) => (
            <li
              key={r.source}
              className="flex items-center gap-3.5 border-t border-social-border py-3.5 first:border-t-0 first:pt-0.5 last:pb-0"
              data-testid={`row-source-${r.source}`}
            >
              <InitialsTile text={sourceTile(r.source)} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <b className="truncate text-[13px] font-semibold xl:text-[14px]">{r.label}</b>
                <RankBar pct={barWidth(r[by], top)} />
              </div>
              <div className="flex flex-col items-end">
                <b className="text-[13px] font-semibold tabular-nums xl:text-[14px]">
                  {by === "profit" ? gbp(r.profit) : plural(r.bookings, "booking")}
                </b>
                <span className="text-[12px] text-social-muted xl:text-[13px]">
                  {share(r[by], total)}% of {by}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-3 text-[12px] text-social-muted xl:text-[13px]">Based on the source chosen on each enquiry.</p>
    </HomeCard>
  );
}
