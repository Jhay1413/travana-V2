import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { requestErrorMessage } from "@/lib/request-error";
import { cn } from "@/lib/utils";
import { useSaveMyTarget } from "../api/use-targets-mutations";
import { useTargetsYear } from "../api/use-targets-queries";
import { liveMonth, profitSoFar } from "../lib/allocation";
import { followYearly, parseYearly, resolveEdit } from "../lib/editing";
import { ownMonths, ownTarget } from "../lib/homeworker";
import { gbp, moneyText, parseMoney } from "../lib/money";
import { evenMonths, FULL_MONTH_LABELS, sum } from "../lib/months";
import { paceStatus, percentOf, STATUS_LABEL } from "../lib/status";
import { useTargetsSession } from "../state/use-targets-session";
import type { HomeworkerYear, TargetsYear } from "../types";
import { TargetsHeader } from "./header/targets-header";
import { MoneyInput } from "./shared/money-input";
import { MonthGrid } from "./shared/month-grid";
import { TargetsEmpty, TargetsError, TargetsLoading } from "./shared/page-state";
import { ChartLegend, ProfitChart } from "./shared/profit-chart";
import { HeroBanner } from "./shared/stat-tiles";
import { ToneMessage } from "./shared/drift-message";
import { TARGETS_CARD } from "./shared/targets-styles";

const asText = (months: readonly number[]): string[] => Array.from({ length: 12 }, (_, i) => moneyText(months[i] ?? 0));

/** /my-targets: a homeworker sets their own yearly and monthly profit target. */
export function MyTargetsPage() {
  const { currentYear, userId } = useTargetsSession();
  const { data, isLoading, isError, refetch } = useTargetsYear(currentYear);
  if (isLoading) return <TargetsLoading />;
  if (isError || !data) return <TargetsError onRetry={() => void refetch()} />;
  const mine = data.homeworkers.find((h) => h.userId === userId) ?? data.homeworkers[0];
  if (!mine) return <TargetsEmpty title="No target to show yet">Your targets appear here once you are set up as a homeworker.</TargetsEmpty>;
  return <MyTargets key={mine.userId} data={data} mine={mine} currentYear={currentYear} />;
}

function MyTargets({ data, mine, currentYear }: { data: TargetsYear; mine: HomeworkerYear; currentYear: number }) {
  const { toast } = useToast();
  const save = useSaveMyTarget();
  const savedMonths = ownMonths(mine);
  const own = ownTarget(mine);
  const [yearly, setYearly] = useState(moneyText(own));
  const [months, setMonths] = useState<string[]>(() => asText(savedMonths));
  const [touched, setTouched] = useState(false);
  const [yearlyError, setYearlyError] = useState<string | null>(null);
  const [monthErrors, setMonthErrors] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = data.canEdit.mine;
  const effective = sum(mine.months);
  const overridden = mine.source === "admin";
  const profit = profitSoFar(mine.actual, data.currentMonth);
  const status = paceStatus(profit, effective, data.elapsed);
  const y = parseMoney(yearly);
  const parsedMonths = months.map((m) => parseMoney(m));
  const monthsSum = sum(parsedMonths.map((r) => (r.ok ? r.value : 0)));
  const monthsOk = parsedMonths.every((r) => r.ok);
  const balanced = y.ok && monthsOk && monthsSum === y.value;
  const toDate = liveMonth(data);
  const currentLabel = toDate > 0 ? FULL_MONTH_LABELS[toDate - 1] : null;

  const clear = () => {
    setYearlyError(null);
    setMonthErrors({});
    setMessage(null);
  };
  const onYearly = (v: string) => {
    setYearly(v);
    clear();
    const r = parseMoney(v);
    // Months you have not typed in follow the yearly target.
    if (!touched && r.ok && r.value > 0) setMonths(asText(followYearly(savedMonths, r.value)));
  };
  const reset = () => {
    setYearly(moneyText(own));
    setMonths(asText(savedMonths));
    setTouched(false);
    clear();
  };
  const splitEvenly = () => {
    const r = parseYearly(yearly);
    if (!r.ok) return setYearlyError(r.error);
    setMonths(asText(evenMonths(r.value)));
    setTouched(true);
    clear();
  };
  const submit = () => {
    const r = resolveEdit({ yearly, months, monthsTouched: touched, base: savedMonths });
    if (!r.ok) {
      setYearlyError(r.yearlyError ?? null);
      setMonthErrors(r.monthErrors ?? {});
      setMessage(r.message ?? null);
      return;
    }
    if (r.yearly === own && r.months.every((m, i) => m === savedMonths[i])) return toast({ title: "No changes to save." });
    save.mutate(
      { year: data.year, months: r.months },
      {
        onSuccess: () => {
          setTouched(false);
          clear();
          toast({ title: "Your target is saved", description: "Your admin can see it." });
        },
        onError: (err: unknown) => setMessage(requestErrorMessage(err, "Couldn't save your target")),
      },
    );
  };

  const note = (() => {
    if (yearlyError) return <ToneMessage tone="bad">{yearlyError}</ToneMessage>;
    if (message) return <ToneMessage tone="bad">{message}</ToneMessage>;
    if (!monthsOk) return <ToneMessage tone="bad">Check the amounts that are marked red. Use whole pounds.</ToneMessage>;
    if (!y.ok) return <ToneMessage tone="bad">{y.error}.</ToneMessage>;
    if (balanced) return <span className="text-[12px] text-social-muted">Months add up to {gbp(monthsSum)}. Your admin can see your target.</span>;
    const d = monthsSum - y.value;
    return (
      <ToneMessage tone="warn">
        Months add up to {gbp(monthsSum)}, which is {gbp(Math.abs(d))} {d > 0 ? "more" : "less"} than your yearly target. Change a month or press Split evenly.
      </ToneMessage>
    );
  })();

  return (
    <div className="min-w-0 space-y-5 text-[14px] leading-[1.5]" data-testid="section-my-targets">
      <TargetsHeader title="My targets" subtitle="You set your own target. Your admin can see it and can change it if needed." year={data.year} currentYear={currentYear} />

      {overridden && (
        <div className="rounded-2xl bg-ticket-amber-bg px-5 py-3.5" role="status" data-testid="override-note">
          <div className="text-[13px] font-semibold">Your admin set your target to {gbp(effective)}</div>
          <div className="text-[12px] text-social-muted">
            {mine.note ? `${mine.note} ` : ""}It replaces your own {gbp(own)} until they remove it. You can still change your own target below, and it is kept.
          </div>
        </div>
      )}

      <HeroBanner
        columns={[
          { label: `My target ${data.year}`, value: gbp(effective), sub: overridden ? "Set by your admin" : "Set by you", testId: "my-target" },
          { label: "Profit so far", value: gbp(profit), sub: `${percentOf(profit, effective)}% of my target` },
          { label: "Still to earn", value: gbp(Math.max(0, effective - profit)), sub: "To reach my target" },
          { label: "Status", value: STATUS_LABEL[status], sub: `${Math.round(data.elapsed * 100)}% of the year has gone` },
        ]}
      />

      <div className="flex flex-wrap items-start gap-5">
        <section className={cn(TARGETS_CARD, "min-w-0 flex-[1_1_460px] p-5")}>
          <h2 className="mb-2 text-[15px] font-semibold">My profit against target</h2>
          <ChartLegend currentMonthLabel={currentLabel} />
          <div className="mt-2">
            <ProfitChart target={mine.months} actual={mine.actual} currentMonth={data.currentMonth} toDate={liveMonth(data)} height={300} />
          </div>
        </section>

        <section className={cn(TARGETS_CARD, "min-w-0 max-w-full flex-[0_1_492px] p-5")} aria-label="Change my target">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Change my target</h2>
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={splitEvenly} disabled={!canEdit} data-testid="button-split-evenly">
              Split evenly
            </Button>
          </div>
          <div className="mb-1.5 text-[12px] text-social-muted">Yearly target</div>
          <MoneyInput value={yearly} onChange={onYearly} disabled={!canEdit} invalid={!!yearlyError || !y.ok} ariaLabel="My yearly target" testId="my-yearly" />
          <div className="mt-4">
            <MonthGrid
              values={months}
              baseline={savedMonths}
              errors={monthErrors}
              labelPrefix="My target for"
              disabled={!canEdit}
              onChange={(i, v) => {
                setTouched(true);
                setMonths((m) => m.map((x, j) => (j === i ? v : x)));
                clear();
              }}
            />
          </div>
          <div className="mt-3.5 min-h-[22px]" role="status" data-testid="months-msg">
            {note}
          </div>
          <div className="mt-3.5 flex justify-end gap-3">
            <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={reset} disabled={save.isPending || !canEdit}>
              Cancel
            </Button>
            <Button type="button" className={PRIMARY_ACTION} onClick={submit} disabled={save.isPending || !canEdit} data-testid="button-save-my-target">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save targets
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
