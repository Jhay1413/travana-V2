import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { HomeCard } from "@/features/agent-overview";
import { CardHead, CardNote, CommissionChart } from "@/features/admin-dashboard";
import { useAgentProfileMonthly } from "../../api/use-agent-profile-queries";
import { buildProfileChart } from "../../lib/chart-model";
import { EmptyBlock } from "../shared/profile-bits";
import { MonthlyTable } from "./monthly-table";

type View = "chart" | "table";

const BASE_LEGEND: Array<{ label: string; swatch: string }> = [
  { label: "On or over target", swatch: "bg-social-navy" },
  { label: "Under target", swatch: "bg-[repeating-linear-gradient(135deg,hsl(var(--social-orange-text))_0_4px,hsl(var(--social-orange))_4px_8px)]" },
  { label: "No target set", swatch: "bg-stage-future-dot" },
];
const SHADED_LEGEND = { label: "Selected period", swatch: "bg-social-navy/10" };

/** Profit each month of this London year; months in the chosen period are shaded. */
export function MonthlyCard({
  userId,
  year,
  firstName,
  isHomeworker,
  lifetimeProfit,
  shaded,
}: {
  userId: string;
  year: number;
  firstName: string;
  isHomeworker: boolean;
  lifetimeProfit: number;
  shaded: string[];
}) {
  const [view, setView] = useState<View>("chart");
  const monthly = useAgentProfileMonthly(userId, year);
  const model = monthly.data && monthly.data.year === year ? buildProfileChart(monthly.data, shaded) : null;
  const anyShaded = !!model?.rows.some((r) => r.shaded);

  return (
    <HomeCard testId="agent-profile-monthly">
      <CardHead
        id="monthly-profit-title"
        title={`${isHomeworker ? "Profit booked" : "Profit earned"} each month, ${year}`}
        sub={anyShaded ? "Shaded months fall in the period selected above." : undefined}
        right={
          <Segmented
            value={view}
            onChange={setView}
            variant="black"
            label="Chart or table"
            items={[
              { value: "chart", label: "Chart", testId: "segment-monthly-chart" },
              { value: "table", label: "Table", testId: "segment-monthly-table" },
            ]}
          />
        }
      />
      {monthly.isError ? (
        <CardNote tone="error" testId="monthly-error">
          We could not load the monthly figures.
        </CardNote>
      ) : !model ? (
        <CardNote testId="monthly-loading">Loading the months...</CardNote>
      ) : !model.hasProfit ? (
        <EmptyBlock title={lifetimeProfit > 0 ? `No profit recorded in ${year} yet` : "No profit recorded yet"} testId="monthly-empty">
          {lifetimeProfit > 0 ? `Their monthly profit for ${year} will appear here.` : `${firstName} has not made a booking yet. Their monthly profit will appear here.`}
        </EmptyBlock>
      ) : view === "chart" ? (
        <>
          <div className="mb-3.5 flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-social-muted xl:text-[13px]">
            {(anyShaded ? [...BASE_LEGEND, SHADED_LEGEND] : BASE_LEGEND).map((l) => (
              <span key={l.label} className="inline-flex items-center gap-2">
                <i className={`inline-block h-3.5 w-3.5 shrink-0 rounded-[3px] ${l.swatch}`} aria-hidden />
                {l.label}
              </span>
            ))}
          </div>
          <CommissionChart months={model.months} shadedMonths={shaded} />
        </>
      ) : (
        <MonthlyTable rows={model.rows} year={model.year} noun={model.noun} />
      )}
    </HomeCard>
  );
}
