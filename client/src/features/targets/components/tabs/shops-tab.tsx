import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { agentsTotal, businessTotal, homeworkersTotal, profitSoFar, shopDrift, shopsTotal } from "../../lib/allocation";
import { HOMEWORKER_SWATCH, shopSwatch } from "../../lib/chart";
import { gbp } from "../../lib/money";
import { MONTH_LABELS, sum, twelve } from "../../lib/months";
import { percentOf } from "../../lib/status";
import type { TargetsYear } from "../../types";
import { MonthHead, MonthRow, WideScroll } from "../shared/month-table";
import { ToneMessage } from "../shared/drift-message";
import { ShopCard } from "../shared/shop-card";
import { StatTile } from "../shared/stat-tiles";
import { TARGETS_CARD } from "../shared/targets-styles";

interface ShopsTabProps {
  data: TargetsYear;
  /** Shops whose totals/months the caller may change. */
  editableShopIds: string[];
  canAllocate: boolean;
  onEditMonths: (branchId: string) => void;
  onEditAllocation: (branchId: string) => void;
}

const n = (v: number) => v.toLocaleString("en-GB");

export function ShopsTab({ data, editableShopIds, canAllocate, onEditMonths, onEditAllocation }: ShopsTabProps) {
  const target = shopsTotal(data);
  const profit = sum(data.branches.map((b) => profitSoFar(b.actual, data.currentMonth)));
  const agentSum = agentsTotal(data);
  const unbalanced = data.branches.filter((b) => shopDrift(data, b.id) !== 0).length;
  const hwMonths = Array.from({ length: 12 }, (_, i) => sum(data.homeworkers.map((h) => twelve(h.months)[i])));
  const totals = Array.from({ length: 12 }, (_, i) => sum(data.branches.map((b) => twelve(b.months)[i])) + hwMonths[i]);
  const bizMonths = data.business ? twelve(data.business.months) : null;
  const off = bizMonths ? MONTH_LABELS.filter((_, i) => totals[i] !== bizMonths[i]) : [];
  const firstEditable = data.branches.find((b) => editableShopIds.includes(b.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <StatTile
          label="Shop targets"
          value={gbp(target)}
          sub={`${data.branches.length} ${data.branches.length === 1 ? "shop" : "shops"}, ${percentOf(target, businessTotal(data))}% of the business target`}
        />
        <StatTile label="Profit so far" value={gbp(profit)} sub={`${percentOf(profit, target)}% of shop targets`} />
        <StatTile label="Allocated to agents" value={`${percentOf(agentSum, target)}%`} sub={`${gbp(agentSum)} of ${gbp(target)}`}>
          {unbalanced === 0 ? (
            <ToneMessage tone="ok">Every shop fully allocated</ToneMessage>
          ) : (
            <ToneMessage tone="warn">
              {unbalanced} {unbalanced === 1 ? "shop is" : "shops are"} not fully allocated
            </ToneMessage>
          )}
        </StatTile>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
        {data.branches.map((b, i) => (
          <ShopCard
            key={b.id}
            data={data}
            branch={b}
            index={i}
            onEditAllocation={canAllocate ? () => onEditAllocation(b.id) : undefined}
            onEditMonths={editableShopIds.includes(b.id) ? () => onEditMonths(b.id) : undefined}
          />
        ))}
      </div>

      <section className={cn(TARGETS_CARD, "py-5")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-5">
          <h2 className="text-[15px] font-semibold">Shop targets by month, £</h2>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-social-muted">
              <Lock className="h-3.5 w-3.5" /> Homeworkers set their own
            </span>
            {firstEditable && (
              <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={() => onEditMonths(firstEditable.id)} data-testid="button-edit-shop-months">
                Edit months
              </Button>
            )}
          </div>
        </div>
        <div className="px-2">
          <WideScroll>
            <MonthHead first="Shop" />
            {data.branches.map((b, i) => (
              <MonthRow
                key={b.id}
                first={i === 0}
                testId={`shop-row-${b.id}`}
                label={
                  <>
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", shopSwatch(i))} />
                    <b className="truncate font-semibold">{b.name}</b>
                  </>
                }
                cells={twelve(b.months).map(n)}
                total={<b>{n(sum(b.months))}</b>}
              />
            ))}
            <MonthRow
              tinted
              testId="shop-row-homeworkers"
              label={
                <>
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", HOMEWORKER_SWATCH)} />
                  <b className="font-semibold">Homeworkers</b>
                  <Lock className="h-3.5 w-3.5 text-social-muted" />
                </>
              }
              cells={hwMonths.map(n)}
              total={<b>{n(homeworkersTotal(data))}</b>}
            />
            <MonthRow bold tinted testId="shop-row-total" label="Business total" cells={totals.map(n)} total={n(sum(totals))} />
          </WideScroll>
        </div>
        {bizMonths && (
          <p className="mt-3 px-5 text-[12px] text-social-muted" role="status">
            {off.length === 0 ? (
              "Shops and homeworkers add up to the business target every month."
            ) : (
              <span className="text-ticket-amber-fg">These months do not match the business target: {off.join(", ")}.</span>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
