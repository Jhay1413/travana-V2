import { useState } from "react";
import { Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { useToast } from "@/hooks/use-toast";
import { ICON_BUTTON, OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { requestErrorMessage } from "@/lib/request-error";
import { cn } from "@/lib/utils";
import { useRevertHomeworkerOverride, useSaveHomeworkerOverride } from "../../api/use-targets-mutations";
import { businessDrift, homeworkersTotal } from "../../lib/allocation";
import { parseYearly } from "../../lib/editing";
import { gbp, moneyText } from "../../lib/money";
import { scaleMonths, sum } from "../../lib/months";
import { ownTarget, ownMonths } from "../../lib/homeworker";
import { paceStatus } from "../../lib/status";
import type { HomeworkerYear, TargetsYear } from "../../types";
import { DiscardDialog } from "../shared/discard-dialog";
import { DriftMessage } from "../shared/drift-message";
import { MoneyInput } from "../shared/money-input";
import { StatusPill } from "../shared/status-pill";
import { TARGETS_CARD, TARGETS_LABEL } from "../shared/targets-styles";

interface OverrideDrawerProps {
  data: TargetsYear;
  homeworker: HomeworkerYear | null;
  profit: number;
  onClose: () => void;
}

export function OverrideDrawer(props: OverrideDrawerProps) {
  const { homeworker, onClose } = props;
  return (
    <Sheet open={!!homeworker} onOpenChange={(open) => !open && onClose()}>
      {homeworker && <DrawerBody key={homeworker.userId} {...props} homeworker={homeworker} />}
    </Sheet>
  );
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] || name;

function DrawerBody({ data, homeworker: h, profit, onClose }: OverrideDrawerProps & { homeworker: HomeworkerYear }) {
  const { toast } = useToast();
  const saveOverride = useSaveHomeworkerOverride();
  const revert = useRevertHomeworkerOverride();
  const own = ownTarget(h);
  const current = sum(h.months);
  const hasOverride = h.source === "admin";
  const [on, setOn] = useState(hasOverride);
  const [amount, setAmount] = useState(moneyText(hasOverride ? current : own));
  const [note, setNote] = useState(h.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const pending = saveOverride.isPending || revert.isPending;
  const [discard, setDiscard] = useState(false);
  const dirty = on !== hasOverride || (on && (amount !== moneyText(current) || note !== (h.note ?? "")));
  const requestClose = () => (dirty ? setDiscard(true) : onClose());
  const first = firstName(h.name);

  const parsed = parseYearly(amount);
  const nextTotal = homeworkersTotal(data) - current + (on ? (parsed.ok ? parsed.value : current) : own);
  const drift = businessDrift(data) + (nextTotal - homeworkersTotal(data));

  const done = (title: string) => {
    toast({ title });
    onClose();
  };
  const failed = (err: unknown) => setError(requestErrorMessage(err, "Couldn't save the override"));

  const submit = () => {
    if (!on) {
      if (!hasOverride) return onClose();
      revert.mutate({ userId: h.userId, year: data.year }, { onSuccess: () => done(`${h.name} sets their own target again`), onError: failed });
      return;
    }
    if (!parsed.ok) return setError(parsed.error);
    saveOverride.mutate(
      { userId: h.userId, year: data.year, months: scaleMonths(ownMonths(h), parsed.value), note: note.trim() || undefined },
      { onSuccess: () => done(`Override saved for ${h.name}`), onError: failed },
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
      data-testid="override-drawer"
    >
      <div className="relative flex-none border-b border-social-border px-6 pb-4 pt-6">
        <button type="button" onClick={requestClose} className={cn(ICON_BUTTON, "absolute right-5 top-5")} aria-label="Close" data-testid="button-close-drawer">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-4 pr-10">
          <PersonAvatar name={h.name} size={48} />
          <div className="min-w-0">
            <SheetTitle className="truncate text-[20px] font-semibold leading-tight">{h.name}</SheetTitle>
            <SheetDescription className="text-[12px] text-social-muted">Homeworker target {data.year}</SheetDescription>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={paceStatus(profit, current, data.elapsed)} />
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-social-muted">{hasOverride ? "Admin override" : "Self-set"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className={cn(TARGETS_CARD, "px-4 py-3.5")}>
          <div className="text-[12px] text-social-muted">{first}&apos;s own target</div>
          <div className="text-[22px] font-semibold tabular-nums">{gbp(own)}</div>
          <div className="text-[12px] text-social-muted">Set by {first}</div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">Override with an admin target</div>
            <div className="text-[12px] text-social-muted">{first} will see that this was set by an admin.</div>
          </div>
          <Switch checked={on} onCheckedChange={(v) => { setOn(v); setError(null); }} aria-label={`Override ${first}'s target`} data-testid="switch-override" />
        </div>

        {on && (
          <div className="space-y-4">
            <div>
              <div className={TARGETS_LABEL}>Admin target for {data.year}</div>
              <MoneyInput value={amount} onChange={(v) => { setAmount(v); setError(null); }} ariaLabel="Admin target" invalid={!!error} edited testId="override-amount" />
              {error && (
                <p className="mt-2 text-[12px] font-semibold text-stage-lost-fg" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div>
              <div className={TARGETS_LABEL}>Note for {first} (optional)</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Why the target was changed" aria-label="Note" className="rounded-[10px] border-social-border text-[13px]" />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-social-orange-text hover:underline"
              onClick={() => { setAmount(moneyText(own)); setError(null); }}
              data-testid="button-revert-amount"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Revert to {first}&apos;s target ({gbp(own)})
            </button>
          </div>
        )}

        <section>
          <h3 className="mb-2 text-[15px] font-semibold">What this changes</h3>
          <p className="text-[12px] leading-relaxed text-social-muted">
            Homeworker total {gbp(nextTotal)} (now {gbp(homeworkersTotal(data))}). The business target stays at {gbp(data.business ? sum(data.business.months) : 0)}.
          </p>
          <div className="mt-2">
            <DriftMessage drift={drift} />
          </div>
          {drift !== 0 && <p className="mt-1 text-[12px] text-social-muted">Adjust the shops from Allocate targets to bring it back to 100%.</p>}
        </section>
      </div>

      <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-social-border px-6 py-3.5">
        <span className="text-[12px] text-social-muted">Homeworkers set their own targets</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={requestClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" className={PRIMARY_ACTION} onClick={submit} disabled={pending} data-testid="button-save-override">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save override
          </Button>
        </div>
      </div>
    </SheetContent>
    <DiscardDialog open={discard} onKeep={() => setDiscard(false)} onDiscard={onClose}>
      You have unsaved changes to {h.name}&apos;s target.
    </DiscardDialog>
    </>
  );
}
