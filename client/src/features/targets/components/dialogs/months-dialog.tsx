import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { requestErrorMessage } from "@/lib/request-error";
import { useSaveAllocation, useSaveBusinessTarget } from "../../api/use-targets-mutations";
import { monthsGapMessage } from "../../lib/editing";
import { gbp, moneyText } from "../../lib/money";
import { evenMonths, parseMonths, sum } from "../../lib/months";
import type { TargetsYear } from "../../types";
import { MonthGrid } from "../shared/month-grid";
import { TARGETS_CONTROL, TARGETS_LABEL } from "../shared/targets-styles";

export type MonthsSubject = { kind: "business" } | { kind: "shop"; branchId: string };

interface MonthsDialogProps {
  data: TargetsYear;
  subject: MonthsSubject;
  /** Shops the caller may change, for the shop picker. */
  editableShopIds: string[];
  onClose: () => void;
}

/** Twelve months for the business or one shop. They must add up to the yearly target, so the split stays balanced. */
export function MonthsDialog({ data, subject, editableShopIds, onClose }: MonthsDialogProps) {
  const [current, setCurrent] = useState<MonthsSubject>(subject);
  const shops = data.branches.filter((b) => editableShopIds.includes(b.id));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[680px] rounded-2xl border-social-border p-6 sm:rounded-2xl" data-testid="months-dialog">
        <MonthsBody key={current.kind === "shop" ? current.branchId : "business"} data={data} subject={current} shops={shops} onPick={(branchId) => setCurrent({ kind: "shop", branchId })} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function MonthsBody({ data, subject, shops, onPick, onClose }: { data: TargetsYear; subject: MonthsSubject; shops: TargetsYear["branches"]; onPick: (branchId: string) => void; onClose: () => void }) {
  const { toast } = useToast();
  const saveBusiness = useSaveBusinessTarget();
  const saveAllocation = useSaveAllocation();
  const shop = subject.kind === "shop" ? data.branches.find((b) => b.id === subject.branchId) : null;
  const baseline = (shop ? shop.months : data.business?.months) ?? [];
  const target = sum(baseline);
  const title = shop ? `${shop.name} by month` : "Business target by month";
  const [vals, setVals] = useState<string[]>(() => Array.from({ length: 12 }, (_, i) => moneyText(baseline[i] ?? 0)));
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const pending = saveBusiness.isPending || saveAllocation.isPending;

  const parsed = parseMonths(vals);
  const total = parsed.ok ? sum(parsed.months) : null;
  const left = total === null ? null : target - total;

  const done = () => {
    toast({ title: `${shop?.name ?? "Business"} months saved` });
    onClose();
  };
  const failed = (err: unknown) => setBanner(requestErrorMessage(err, "Couldn't save the months"));

  const save = () => {
    const r = parseMonths(vals);
    if (!r.ok) {
      setErrors(r.errors);
      return setBanner("Fix the highlighted months. Use whole pounds, for example 8,300.");
    }
    const gap = monthsGapMessage(sum(r.months), target);
    if (gap) return setBanner(gap);
    if (shop) {
      saveAllocation.mutate({ year: data.year, shops: [{ branchId: shop.id, months: r.months }] }, { onSuccess: done, onError: failed });
    } else {
      saveBusiness.mutate({ year: data.year, months: r.months }, { onSuccess: done, onError: failed });
    }
  };

  const touch = (fn: () => void) => {
    fn();
    setErrors({});
    setBanner(null);
  };

  return (
    <>
      <DialogTitle className="text-[18px] font-semibold">{title}</DialogTitle>
      <DialogDescription className="text-[13px] text-social-muted">
        The months must add up to the yearly target of {gbp(target)}. Orange dots mark months you changed.
      </DialogDescription>
      {shop && shops.length > 1 && (
        <div className="w-60">
          <div className={TARGETS_LABEL}>Shop</div>
          <Select value={shop.id} onValueChange={onPick}>
            <SelectTrigger className={TARGETS_CONTROL} aria-label="Shop">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {shops.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <MonthGrid values={vals} baseline={baseline} errors={errors} labelPrefix="Month" onChange={(i, v) => touch(() => setVals((x) => x.map((y, j) => (j === i ? v : y))))} />
      <div className="flex flex-wrap items-center gap-3">
        <span className={left === 0 ? "text-[13px] font-semibold text-status-scheduled-fg" : left === null ? "text-[13px] font-semibold text-stage-lost-fg" : "text-[13px] font-semibold text-ticket-amber-fg"} role="status" data-testid="months-total">
          {total === null ? "Check the months" : `Months add up to ${gbp(total)} of ${gbp(target)}`}
          {left !== null && left !== 0 && ` (${left > 0 ? `${gbp(left)} left` : `${gbp(-left)} over`})`}
        </span>
        <span className="flex-1" />
        <Button type="button" variant="outline" size="sm" className={OUTLINE_ACTION} onClick={() => touch(() => setVals(evenMonths(target).map(moneyText)))}>
          Split evenly
        </Button>
        <Button type="button" variant="outline" size="sm" className={OUTLINE_ACTION} onClick={() => touch(() => setVals(baseline.map(moneyText)))}>
          Reset
        </Button>
      </div>
      {banner && (
        <p className="text-[12px] font-semibold text-stage-lost-fg" role="alert">
          {banner}
        </p>
      )}
      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" className={PRIMARY_ACTION} onClick={save} disabled={pending} data-testid="button-save-months">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save months
        </Button>
      </div>
    </>
  );
}
