import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { HomeCard } from "@/features/agent-overview/components/home/home-ui";
import type { OrganizationOverviewTrendPoint } from "@/features/organization/api/organization-overview.api";
import { londonYearMonth } from "@/lib/london-day";
import { buildChartMonths } from "../lib/chart-model";
import { CommissionChart } from "./commission-chart";
import { CommissionTable } from "./commission-table";
import { CardHead, CardNote } from "./shared/bits";

type View = "chart" | "table";

const LEGEND: Array<{ label: string; swatch: string }> = [
  { label: "On or over target", swatch: "bg-social-navy" },
  { label: "Under target", swatch: "bg-[repeating-linear-gradient(135deg,hsl(var(--social-orange-text))_0_4px,hsl(var(--social-orange))_4px_8px)]" },
  { label: "No target set", swatch: "bg-stage-future-dot" },
  { label: "Target", swatch: "h-[3px] w-[18px] rounded-none bg-foreground" },
];

export function CommissionChartCard({ trend, className }: { trend: OrganizationOverviewTrendPoint[]; className?: string }) {
  const [view, setView] = useState<View>("chart");
  const months = buildChartMonths(trend, londonYearMonth(new Date()));
  const year = trend[0]?.month?.slice(0, 4) ?? String(londonYearMonth(new Date()).year);

  return (
    <HomeCard className={`flex flex-col ${className ?? ""}`} testId="commission-trend-card">
      <CardHead
        id="commission-chart-title"
        title={`Commission against target, ${year}`}
        sub="Each bar is a month's commission. The dark tick marks that month's target."
        right={
          <Segmented<View>
            value={view}
            onChange={setView}
            variant="black"
            label="Chart or table"
            items={[
              { value: "chart", label: "Chart", testId: "segment-commission-chart" },
              { value: "table", label: "Table", testId: "segment-commission-table" },
            ]}
          />
        }
      />
      <div className="mb-3.5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-social-muted xl:text-[13px]" data-testid="commission-legend">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-2">
            <i className={`inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] ${l.swatch}`} aria-hidden />
            {l.label}
          </span>
        ))}
      </div>
      {months.length === 0 ? (
        <CardNote testId="commission-empty">No commission data yet.</CardNote>
      ) : view === "chart" ? (
        <CommissionChart months={months} />
      ) : (
        <CommissionTable months={months} year={year} />
      )}
    </HomeCard>
  );
}
