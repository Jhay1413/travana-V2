import { useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { requestErrorMessage } from "@/lib/request-error";
import { cn } from "@/lib/utils";
import { useSaveAllocation } from "../../api/use-targets-mutations";
import { useTargetsYear } from "../../api/use-targets-queries";
import { canRunAllocation } from "../../lib/access";
import {
  buildAllocationInput,
  calcPlan,
  changeRows,
  changedRows,
  clampStep,
  effectivePlan,
  findConflicts,
  planFromYear,
  reachableStep,
  reconcilePlan,
  resolveConflict,
  stepProblems,
  type PlanConflict,
  type StepNo,
} from "../../lib/plan";
import { gbp, moneyText } from "../../lib/money";
import { evenParts } from "../../lib/months";
import { tabPath, wizardPath } from "../../lib/routes";
import { useTargetsSession } from "../../state/use-targets-session";
import { useWizardDraft } from "../../state/use-wizard-draft";
import type { Plan, TargetsYear } from "../../types";
import { TargetsHeader } from "../header/targets-header";
import { DiscardDialog } from "../shared/discard-dialog";
import { TargetsEmpty, TargetsError, TargetsLoading } from "../shared/page-state";
import { TARGETS_CARD } from "../shared/targets-styles";
import { ConflictsNotice } from "./conflicts-notice";
import { StepAgents } from "./step-agents";
import { StepBusiness } from "./step-business";
import { StepReview } from "./step-review";
import { StepShops } from "./step-shops";
import { AgentsSide, HowItWorks, NEXT_LABEL, Panel, ReviewSide, STEP_HEAD, WhoCanChange } from "./wizard-side";
import { WizardStepper } from "./wizard-stepper";

/** /agency/targets/allocate: the four-step guided allocation. */
export function WizardPage({ year }: { year: number }) {
  const { data, isLoading, isError, refetch } = useTargetsYear(year);
  const { currentYear } = useTargetsSession();
  const [, navigate] = useLocation();
  if (isLoading) return <TargetsLoading />;
  if (isError || !data) return <TargetsError onRetry={() => void refetch()} />;
  if (!canRunAllocation(data.canEdit)) {
    return (
      <div className="space-y-4">
        <TargetsEmpty title="Only the owner or an admin can allocate targets">
          Branch managers can change their agents&apos; targets from the Targets page.
        </TargetsEmpty>
        <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => navigate(tabPath("business", year, currentYear))}>
          Back to Targets
        </Button>
      </div>
    );
  }
  return <WizardBody key={year} data={data} year={year} />;
}

function WizardBody({ data, year }: { data: TargetsYear; year: number }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { currentYear, orgId, userId } = useTargetsSession();
  const draftApi = useWizardDraft(orgId, userId, year);
  const save = useSaveAllocation();

  // A saved draft (read on the first render) wins over the saved numbers; people who left are dropped from it.
  // The snapshot is what the person started from: only boxes that differ from it count as their changes.
  const [plan, setPlan] = useState<Plan>(() => (draftApi.draft ? reconcilePlan(draftApi.draft.plan, data) : planFromYear(data)));
  const [snapshot, setSnapshot] = useState<Plan>(() => (draftApi.draft ? reconcilePlan(draftApi.draft.snapshot, data) : planFromYear(data)));
  const baselineOf = useRef(JSON.stringify(plan));
  const [tried, setTried] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const live = useMemo(() => planFromYear(data), [data]);
  // Boxes the person did not change always show the latest saved figure.
  const view = useMemo(() => effectivePlan(plan, snapshot, live), [plan, snapshot, live]);
  const conflicts = useMemo(() => findConflicts(plan, snapshot, data), [plan, snapshot, data]);
  const calc = useMemo(() => calcPlan(view, data), [view, data]);
  const dirty = JSON.stringify(plan) !== baselineOf.current;
  const reach = reachableStep(calc);
  const params = new URLSearchParams(search);
  const step: StepNo = clampStep(params.get("step"), reach);
  const askedShop = params.get("shop");
  const firstShop = data.branches[0]?.id ?? "";
  const shopId = askedShop && data.branches.some((b) => b.id === askedShop) ? askedShop : firstShop;
  const shopName = data.branches.find((b) => b.id === shopId)?.name ?? "";

  const go = (to: number, branchId?: string | null) => {
    setTried(false);
    navigate(wizardPath({ step: to, branchId, year, currentYear }));
  };
  const leave = () => navigate(tabPath("business", year, currentYear));
  const tryLeave = () => (dirty ? setLeaving(true) : leave());

  const saveForLater = () => {
    if (draftApi.save(plan, snapshot, step)) {
      baselineOf.current = JSON.stringify(plan);
      toast({ title: "Draft saved", description: "Pick it up from Targets any time." });
      leave();
    } else {
      toast({ title: "Couldn't save the draft", description: "This browser would not store it.", variant: "destructive" });
    }
  };

  const setBusiness = (v: string) => setPlan((p) => ({ ...p, business: v }));
  const setShop = (id: string, v: string) => setPlan((p) => ({ ...p, shops: { ...p.shops, [id]: v } }));
  const setAgent = (id: string, v: string) => setPlan((p) => ({ ...p, agents: { ...p.agents, [id]: v } }));
  const setAgents = (values: Record<string, string>) => setPlan((p) => ({ ...p, agents: { ...p.agents, ...values } }));

  const problems = stepProblems(step, view, data, calc);
  const resolve = (c: PlanConflict, choice: "mine" | "latest") => {
    const next = resolveConflict(plan, snapshot, c, choice);
    setPlan(next.plan);
    setSnapshot(next.snapshot);
  };

  const finish = () => {
    if (conflicts.length > 0) {
      setSaveError("Choose Keep mine or Use latest for the targets that changed while you were working.");
      return;
    }
    const input = buildAllocationInput(view, snapshot, data);
    const count = changedRows(changeRows(view, data)).length;
    const done = (title: string) => {
      draftApi.discard();
      baselineOf.current = JSON.stringify(plan);
      toast({ title });
      leave();
    };
    if (!input) return done("Nothing changed. Your targets are already up to date.");
    setSaveError(null);
    save.mutate(input, {
      onSuccess: () => done(`Targets saved. ${count} ${count === 1 ? "target" : "targets"} updated.`),
      onError: (err: unknown) => setSaveError(requestErrorMessage(err, "Couldn't save the targets")),
    });
  };

  const next = () => {
    if (problems.length > 0) {
      setTried(true);
      if (step === 3) {
        const bad = calc.shopRows.find((r) => !r.done);
        if (bad && bad.branchId !== shopId) go(3, bad.branchId);
      }
      return;
    }
    if (step < 4) return go(step + 1, step === 2 ? firstShop : undefined);
    finish();
  };
  const back = () => (step === 1 ? tryLeave() : go(step - 1, step === 4 ? firstShop : undefined));

  const splitShopsEvenly = () => {
    if (!calc.bizOk) return toast({ title: "Set the business target in step 1 first." });
    const parts = evenParts(Math.max(0, calc.numbers.business - calc.homeworkers), data.branches.length);
    setPlan((p) => ({ ...p, shops: Object.fromEntries(data.branches.map((b, i) => [b.id, moneyText(parts[i])])) }));
    setTried(false);
  };
  const resetShops = () => {
    setPlan((p) => ({ ...p, shops: live.shops }));
    setSnapshot((p) => ({ ...p, shops: live.shops }));
    setTried(false);
    toast({ title: "Shop targets put back to what is saved." });
  };

  return (
    <div className="min-w-0 space-y-5 text-[14px] leading-[1.5]" data-testid="section-wizard">
      <div>
        <button type="button" onClick={tryLeave} className="inline-flex items-center gap-1 text-[13px] font-semibold text-social-orange-text hover:underline" aria-label="Back to Targets">
          <ArrowLeft className="h-3.5 w-3.5" /> Targets
        </button>
        <TargetsHeader title={STEP_HEAD[step].title} subtitle={STEP_HEAD[step].sub} year={year} currentYear={currentYear} />
      </div>
      <WizardStepper step={step} reach={reach} onGo={(s) => go(s, s === 3 ? firstShop : undefined)} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className={cn(TARGETS_CARD, "p-5 sm:p-7")} aria-label={`Step ${step}`} data-testid={`wizard-step-${step}`}>
          <ConflictsNotice conflicts={conflicts} onResolve={resolve} />
          {step === 1 && <StepBusiness year={year} plan={view} calc={calc} onChange={setBusiness} />}
          {step === 2 && <StepShops data={data} plan={view} calc={calc} onShop={setShop} onChangeBusiness={() => go(1)} />}
          {step === 3 && <StepAgents data={data} plan={view} calc={calc} branchId={shopId} onBranch={(id) => go(3, id)} onAgent={setAgent} onAgents={setAgents} />}
          {step === 4 && <StepReview data={data} plan={view} onlyChanges={onlyChanges} onOnlyChanges={setOnlyChanges} />}

          {((tried && problems.length > 0) || saveError) && (
            <div role="alert" data-testid="wizard-problems" className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-stage-lost-dot/40 bg-stage-lost-bg px-3.5 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-stage-lost-fg" />
              <div className="text-[13px] leading-relaxed text-stage-lost-fg">
                {(saveError ? [saveError] : problems).map((t) => (
                  <div key={t}>{t}</div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-social-border pt-5">
            <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={back} disabled={save.isPending} data-testid="button-back">
              {step === 1 ? "Cancel" : (<><ArrowLeft className="h-4 w-4" />Back</>)}
            </Button>
            <div className="flex flex-wrap items-center gap-5">
              <button type="button" onClick={saveForLater} className="text-[14px] text-social-muted hover:text-foreground hover:underline" data-testid="button-save-later">
                Save and finish later
              </button>
              <Button type="button" className={cn(PRIMARY_ACTION, "min-w-40")} onClick={next} disabled={save.isPending} data-testid="button-next">
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 4 && <Check className="h-4 w-4" />}
                {NEXT_LABEL[step]}
                {step !== 4 && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </section>

        <aside aria-label="Help">
          {step === 1 && <HowItWorks />}
          {step === 2 && (
            <>
              <Panel title="Quick actions">
                <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "w-full")} onClick={splitShopsEvenly} data-testid="button-split-evenly-shops">
                  Split evenly
                </Button>
                <p className="mb-3 mt-2 text-[12px] text-social-muted">
                  {calc.bizOk
                    ? `Gives each shop ${gbp(Math.floor(Math.max(0, calc.numbers.business - calc.homeworkers) / Math.max(1, data.branches.length)))} after homeworkers.`
                    : "Set the business target first."}
                </p>
                <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "w-full")} onClick={resetShops} data-testid="button-reset-shops">
                  Reset to last saved
                </Button>
              </Panel>
              <WhoCanChange />
            </>
          )}
          {step === 3 && <AgentsSide calc={calc} shopName={shopName} onShop={(id) => go(3, id)} />}
          {step === 4 && <ReviewSide />}
        </aside>
      </div>

      <DiscardDialog
        open={leaving}
        title="Leave without saving?"
        discardLabel="Discard changes"
        onKeep={() => setLeaving(false)}
        onDiscard={leave}
        extra={
          <Button type="button" className={PRIMARY_ACTION} onClick={saveForLater} data-testid="button-save-draft">
            Save draft
          </Button>
        }
      >
        You have changes that are not saved yet. Save them as a draft to carry on later, or throw them away.
      </DiscardDialog>
    </div>
  );
}
