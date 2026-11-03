import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { businessDrift, businessTotal, homeworkersTotal, isBusinessSet, liveMonth, profitSoFar, shopsTotal, unbalancedMonths } from "../../lib/allocation";
import { HOMEWORKER_SWATCH, monthCell, shopSwatch } from "../../lib/chart";
import { FULL_MONTH_LABELS, MONTH_LABELS, sum } from "../../lib/months";
import { gbp } from "../../lib/money";
import { percentOf } from "../../lib/status";
import type { TargetsYear } from "../../types";
import { AllocBar } from "../shared/alloc-bar";
import { DriftMessage } from "../shared/drift-message";
import { MonthHead, MonthRow, WideScroll } from "../shared/month-table";
import { ChartLegend, ProfitChart } from "../shared/profit-chart";
import { HeroBanner } from "../shared/stat-tiles";
import { TARGETS_CARD } from "../shared/targets-styles";

interface BusinessTabProps {
  data: TargetsYear;
  canEdit: boolean;
  onEditYear: () => void;
  onEditMonths: () => void;
  onChangeSplit: () => void;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-social-border py-2.5 text-[13px]">
      <span className="text-social-muted">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

export function BusinessTab({ data, canEdit, onEditYear, onEditMonths, onChangeSplit }: BusinessTabProps) {
  const business = data.business;
  if (!business || !isBusinessSet(data)) {
    return (
      <div className={cn(TARGETS_CARD, "p-10 text-center")} data-testid="business-empty">
        <div className="text-[15px] font-semibold">No business target for {data.year} yet</div>
        <p className="mt-1 text-[13px] text-social-muted">Set the yearly profit the whole business is aiming for, then share it between shops.</p>
        {canEdit && (
          <Button type="button" className={cn(PRIMARY_ACTION, "mt-4")} onClick={onEditYear} data-testid="button-set-business-target">
            Set business target
          </Button>
        )}
      </div>
    );
  }

  const target = businessTotal(data);
  const profit = profitSoFar(business.actual, data.currentMonth);
  const drift = businessDrift(data);
  const allocated = shopsTotal(data) + homeworkersTotal(data);
  const hi = business.months.indexOf(Math.max(...business.months));
  const lo = business.months.indexOf(Math.min(...business.months));
  const off = unbalancedMonths(data);
  const slices = [
    ...data.branches.map((b, i) => ({ name: b.name, value: sum(b.months), colour: shopSwatch(i) })),
    { name: "Homeworkers", value: homeworkersTotal(data), colour: HOMEWORKER_SWATCH },
  ];
  const toDate = liveMonth(data);
  const currentLabel = toDate > 0 ? FULL_MONTH_LABELS[toDate - 1] : null;

  return (
    <div className="space-y-5">
      <HeroBanner
        columns={[
          { label: `Business target ${data.year}`, value: gbp(target), sub: "Shops and homeworkers", testId: "business-target" },
          { label: "Profit so far", value: gbp(profit), sub: `${percentOf(profit, target)}% of the target` },
          { label: "Still to earn", value: gbp(Math.max(0, target - profit)), sub: "To reach the year target" },
          {
            label: "Allocated",
            value: `${percentOf(allocated, target)}%`,
            sub: drift === 0 ? "Nothing left unassigned" : drift < 0 ? `${gbp(-drift)} not allocated yet` : `${gbp(drift)} over the target`,
          },
        ]}
      />

      <section className={cn(TARGETS_CARD, "p-5")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">How the {gbp(target)} is split</h2>
          {canEdit && (
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={onChangeSplit} data-testid="button-change-split">
              Change split
            </Button>
          )}
        </div>
        <AllocBar slices={slices} total={target} />
        {drift !== 0 && (
          <div className="mt-3">
            <DriftMessage drift={drift} />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-stretch gap-5">
        <section className={cn(TARGETS_CARD, "min-w-0 flex-[1_1_520px] p-5")}>
          <h2 className="mb-2 text-[15px] font-semibold">Business profit against target, {data.year}</h2>
          <ChartLegend currentMonthLabel={currentLabel} />
          <div className="mt-2">
            <ProfitChart target={business.months} actual={business.actual} currentMonth={data.currentMonth} toDate={toDate} height={400} />
          </div>
        </section>
        <section className={cn(TARGETS_CARD, "w-full flex-[0_0_340px] p-5 max-lg:flex-[1_1_100%]")} aria-label="Business target">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Business target</h2>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-social-muted">Owner / Admin only</span>
          </div>
          <div className="mt-2 text-[12px] text-social-muted">Yearly target {data.year}</div>
          <div className="mb-3 text-[32px] font-semibold leading-tight">{gbp(target)}</div>
          <KeyValue label="Average a month" value={gbp(Math.round(target / 12))} />
          <KeyValue label="Busiest month" value={`${FULL_MONTH_LABELS[hi]} ${gbp(business.months[hi])}`} />
          <KeyValue label="Quietest month" value={`${FULL_MONTH_LABELS[lo]} ${gbp(business.months[lo])}`} />
          <KeyValue label="Shops" value={gbp(shopsTotal(data))} />
          <KeyValue label="Homeworkers (self-set)" value={gbp(homeworkersTotal(data))} />
          {canEdit && (
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" className={PRIMARY_ACTION} onClick={onEditYear} data-testid="button-edit-year">
                Edit year target
              </Button>
              <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onEditMonths} data-testid="button-edit-business-months">
                Edit months
              </Button>
            </div>
          )}
        </section>
      </div>

      <section className={cn(TARGETS_CARD, "py-5")}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-5">
          <h2 className="text-[15px] font-semibold">Month by month</h2>
          <span className="text-[12px] text-social-muted">Plus or minus compares profit with that month&apos;s target</span>
        </div>
        <div className="px-2">
          <WideScroll>
            <MonthHead first="Business, £" />
            <MonthRow first label="Target" cells={business.months.map((v) => v.toLocaleString("en-GB"))} total={target.toLocaleString("en-GB")} />
            <MonthRow
              label="Profit"
              cells={MONTH_LABELS.map((_, i) => (i < data.currentMonth ? (business.actual[i] ?? 0).toLocaleString("en-GB") : null))}
              total={profit.toLocaleString("en-GB")}
            />
            <MonthRow
              label="Difference"
              cells={MONTH_LABELS.map((_, i) => {
                const cell = monthCell(i, data.currentMonth, business.actual[i] ?? 0, business.months[i] ?? 0, toDate);
                if (cell.kind === "future") return null;
                if (cell.kind === "current") return <span className="text-[12px] text-social-muted">to date</span>;
                return (
                  <span className={cn("font-semibold", cell.diff >= 0 ? "text-status-scheduled-fg" : "text-stage-lost-fg")}>
                    {cell.diff >= 0 ? "+" : "−"}
                    {Math.abs(cell.diff).toLocaleString("en-GB")}
                  </span>
                );
              })}
              total={<span className="font-normal text-social-muted">{gbp(Math.max(0, target - profit))} to go</span>}
            />
          </WideScroll>
        </div>
        {off.length > 0 && (
          <p className="mt-3 px-5 text-[12px] text-ticket-amber-fg" role="status">
            Shops and homeworkers do not add up to the business target in: {off.map((i) => MONTH_LABELS[i]).join(", ")}.
          </p>
        )}
      </section>
    </div>
  );
}
