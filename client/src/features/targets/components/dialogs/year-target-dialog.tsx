import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";
import { requestErrorMessage } from "@/lib/request-error";
import { useSaveBusinessTarget } from "../../api/use-targets-mutations";
import { parseYearly } from "../../lib/editing";
import { gbp, moneyText } from "../../lib/money";
import { scaleMonths, sum } from "../../lib/months";
import { MoneyInput } from "../shared/money-input";
import { TARGETS_LABEL } from "../shared/targets-styles";

interface YearTargetDialogProps {
  year: number;
  /** Saved business months; empty when no target has been set yet. */
  months: readonly number[];
  onClose: () => void;
}

/** Owner / admin: change the yearly business target. The months are rescaled to keep their busy and quiet pattern. */
export function YearTargetDialog({ year, months, onClose }: YearTargetDialogProps) {
  const { toast } = useToast();
  const save = useSaveBusinessTarget();
  const current = sum(months);
  const [value, setValue] = useState(moneyText(current));
  const [error, setError] = useState<string | null>(null);
  const parsed = parseYearly(value);
  const diff = parsed.ok ? parsed.value - current : 0;

  const submit = () => {
    if (!parsed.ok) return setError(parsed.error);
    save.mutate(
      { year, months: scaleMonths(months, parsed.value) },
      {
        onSuccess: () => {
          toast({ title: "Business target saved" });
          onClose();
        },
        onError: (err: unknown) => setError(requestErrorMessage(err, "Couldn't save the target")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-w-[480px] rounded-2xl border-social-border p-6 sm:rounded-2xl" data-testid="year-target-dialog">
        <DialogTitle className="text-[18px] font-semibold">Edit the {year} business target</DialogTitle>
        <DialogDescription className="text-[13px] text-social-muted">
          Months are scaled to match. Shops and homeworkers are not changed, so check the split afterwards.
        </DialogDescription>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className={TARGETS_LABEL}>Yearly business target</div>
          <MoneyInput value={value} onChange={(v) => { setValue(v); setError(null); }} ariaLabel="Yearly business target" invalid={!!error} autoFocus testId="year-target-input" />
          {error ? (
            <p className="mt-2 text-[12px] font-semibold text-stage-lost-fg" role="alert">{error}</p>
          ) : parsed.ok && diff !== 0 ? (
            <p className="mt-2 text-[12px] text-social-muted">
              {diff > 0 ? "Up" : "Down"} {gbp(Math.abs(diff))} on the current {gbp(current)}.
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2.5">
            <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onClose} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" className={PRIMARY_ACTION} disabled={save.isPending} data-testid="button-save-year-target">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save target
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
