import { useState } from "react";
import { agentKey } from "../../lib/allocation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { useToast } from "@/hooks/use-toast";
import { ICON_BUTTON, OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { requestErrorMessage } from "@/lib/request-error";
import { cn } from "@/lib/utils";
import { useSaveAllocation } from "../../api/use-targets-mutations";
import { shopDrift } from "../../lib/allocation";
import { followYearly, resolveEdit } from "../../lib/editing";
import { gbp, moneyText, parseMoney } from "../../lib/money";
import { evenMonths, sum } from "../../lib/months";
import { paceStatus, percentOf } from "../../lib/status";
import type { AgentYear, TargetsYear } from "../../types";
import { DiscardDialog } from "../shared/discard-dialog";
import { DriftMessage } from "../shared/drift-message";
import { MonthGrid } from "../shared/month-grid";
import { MoneyInput } from "../shared/money-input";
import { StatusPill } from "../shared/status-pill";
import { TARGETS_CARD } from "../shared/targets-styles";

interface AgentDrawerProps {
  data: TargetsYear;
  agent: AgentYear | null;
  /** Whether the server lets the caller change this agent. */
  editable: boolean;
  profit: number;
  onClose: () => void;
}

export function AgentDrawer(props: AgentDrawerProps) {
  const { agent, onClose } = props;
  return (
    <Sheet open={!!agent} onOpenChange={(open) => !open && onClose()}>
      {agent && <DrawerBody key={agentKey(agent)} {...props} agent={agent} />}
    </Sheet>
  );
}

const asText = (months: readonly number[]): string[] => Array.from({ length: 12 }, (_, i) => moneyText(months[i] ?? 0));

function DrawerBody({ data, agent, editable, profit, onClose }: AgentDrawerProps & { agent: AgentYear }) {
  const { toast } = useToast();
  const save = useSaveAllocation();
  const saved = sum(agent.months);
  const [yearly, setYearly] = useState(moneyText(saved));
  const [months, setMonths] = useState<string[]>(() => asText(agent.months));
  const [monthsTouched, setMonthsTouched] = useState(false);
  const [yearlyError, setYearlyError] = useState<string | null>(null);
  const [monthErrors, setMonthErrors] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [discard, setDiscard] = useState(false);

  const branch = data.branches.find((b) => b.id === agent.branchId);
  const y = parseMoney(yearly);
  const dirty = yearly !== moneyText(saved) || months.join() !== asText(agent.months).join();
  const readOnly = !editable || !!agent.inactive;
  const drift = shopDrift(data, agent.branchId) - saved + (y.ok ? y.value : saved);
  const status = paceStatus(profit, saved, data.elapsed);

  const clear = () => {
    setYearlyError(null);
    setMonthErrors({});
    setMessage(null);
  };
  const requestClose = () => (dirty ? setDiscard(true) : onClose());

  const onYearly = (v: string) => {
    setYearly(v);
    clear();
    const r = parseMoney(v);
    // Months nobody has typed in follow the yearly target.
    if (!monthsTouched && r.ok) setMonths(asText(followYearly(agent.months, r.value)));
  };

  const submit = () => {
    const r = resolveEdit({ yearly, months, monthsTouched, base: agent.months, allowZero: true });
    if (!r.ok) {
      setYearlyError(r.yearlyError ?? null);
      setMonthErrors(r.monthErrors ?? {});
      setMessage(r.message ?? null);
      return;
    }
    save.mutate(
      { year: data.year, agents: [{ branchId: agent.branchId, userId: agent.userId, months: r.months }] },
      {
        onSuccess: () => {
          toast({ title: `Target saved for ${agent.name}` });
          onClose();
        },
        onError: (err: unknown) => setMessage(requestErrorMessage(err, "Couldn't save the target")),
      },
    );
  };

  return (
    <>
      <SheetContent
        side="right"
        hideClose
        onInteractOutside={(e) => {
          if (dirty) {
            e.preventDefault();
            requestClose();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (dirty) {
            e.preventDefault();
            requestClose();
          }
        }}
        className="flex w-full flex-col gap-0 border-social-border p-0 sm:max-w-[520px]"
        data-testid="agent-drawer"
      >
        <div className="relative flex-none border-b border-social-border px-6 pb-4 pt-6">
          <button type="button" onClick={requestClose} className={cn(ICON_BUTTON, "absolute right-5 top-5")} aria-label="Close" data-testid="button-close-drawer">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4 pr-10">
            <PersonAvatar name={agent.name} size={48} />
            <div className="min-w-0">
              <SheetTitle className="truncate text-[20px] font-semibold leading-tight">{agent.name}</SheetTitle>
              <SheetDescription className="truncate text-[12px] text-social-muted">
                Agent target {data.year}
                {branch ? ` · ${branch.name}` : ""}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill status={status} />
                {agent.inactive && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-social-muted">Inactive</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="text-[15px] font-semibold">Yearly target</h3>
            <div className="mt-3 flex items-end gap-2.5">
              <div className="flex-1">
                <div className="mb-1.5 text-[13px] text-social-muted">
                  {agent.name}, {data.year}
                </div>
                <MoneyInput value={yearly} onChange={onYearly} ariaLabel="Yearly target" invalid={!!yearlyError} disabled={readOnly} testId="agent-yearly" />
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  className={OUTLINE_ACTION}
                  onClick={() => {
                    if (!y.ok) return;
                    setMonths(asText(evenMonths(y.value)));
                    setMonthsTouched(true);
                    clear();
                  }}
                  data-testid="button-split-evenly"
                >
                  Split evenly
                </Button>
              )}
            </div>
            {yearlyError && (
              <p className="mt-2 text-[12px] font-semibold text-stage-lost-fg" role="alert">
                {yearlyError}
              </p>
            )}
            <p className="mt-2 text-[12px] text-social-muted">
              So far {gbp(profit)} ({percentOf(profit, saved)}% of the current target).
            </p>
          </section>

          <section>
            <h3 className="text-[15px] font-semibold">Month by month</h3>
            <p className="mb-3 text-[12px] text-social-muted">Leave the months alone and they follow the yearly target. Orange dots mark months you changed.</p>
            <MonthGrid
              values={months}
              baseline={agent.months}
              errors={monthErrors}
              labelPrefix="Agent month"
              disabled={readOnly}
              onChange={(i, v) => {
                setMonthsTouched(true);
                setMonths((m) => m.map((x, j) => (j === i ? v : x)));
                clear();
              }}
            />
            {message && (
              <p className="mt-3 text-[12px] font-semibold text-stage-lost-fg" role="alert" data-testid="agent-drawer-message">
                {message}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-[15px] font-semibold">{branch?.name ?? "Shop"} allocation</h3>
            <div className={cn(TARGETS_CARD, "flex items-center justify-between gap-3 px-4 py-3 text-[13px]")}>
              <span>Shop target {gbp(branch ? sum(branch.months) : 0)}</span>
              <DriftMessage drift={drift} />
            </div>
          </section>
        </div>

        <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-social-border px-6 py-3.5">
          <span className="text-[12px] text-social-muted">
            {readOnly ? "You can view this target but not change it" : "Owner / Admin and the shop's Branch Manager can edit this"}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={requestClose}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="button" className={PRIMARY_ACTION} onClick={submit} disabled={save.isPending} data-testid="button-save-agent">
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save target
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
      <DiscardDialog open={discard} onKeep={() => setDiscard(false)} onDiscard={onClose}>
        You have unsaved changes to {agent.name}&apos;s target.
      </DiscardDialog>
    </>
  );
}
