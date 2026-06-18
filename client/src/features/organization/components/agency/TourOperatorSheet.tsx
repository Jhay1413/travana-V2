import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TourOperator } from "@/features/tour-operator/types";
import { SettingsField, SettingsSection } from "./SettingsField";

export interface TourOperatorFormState {
  name: string;
  commissionPercentage: string;
}

export function emptyTourOperatorForm(): TourOperatorFormState {
  return { name: "", commissionPercentage: "" };
}

export function tourOperatorToForm(op: TourOperator): TourOperatorFormState {
  return {
    name: op.name ?? "",
    commissionPercentage: op.commission_percentage ?? "",
  };
}

export function TourOperatorSheet({
  open,
  operator,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  operator: TourOperator | null;
  onClose: () => void;
  onSubmit: (form: TourOperatorFormState) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<TourOperatorFormState>(emptyTourOperatorForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(operator ? tourOperatorToForm(operator) : emptyTourOperatorForm());
    setError(null);
  }, [open, operator]);

  const update = <K extends keyof TourOperatorFormState>(key: K, value: TourOperatorFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (form.commissionPercentage !== "") {
      const n = Number(form.commissionPercentage);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setError("Commission must be a number between 0 and 100");
        return;
      }
    }
    setError(null);
    onSubmit(form);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{operator ? "Edit tour operator" : "New tour operator"}</SheetTitle>
          <SheetDescription>
            {operator
              ? "Update the operator's name and default commission percentage."
              : "Add a tour operator to your agency's catalog."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <SettingsSection title="Details">
            <SettingsField label="Name" required>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="TUI"
                autoFocus
                data-testid="input-tour-operator-name"
              />
            </SettingsField>
            <SettingsField label="Commission %">
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.commissionPercentage}
                  onChange={(e) =>
                    update("commissionPercentage", e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="10.00"
                  className="pr-8"
                  data-testid="input-tour-operator-commission"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/40 dark:text-white/40">
                  %
                </span>
              </div>
            </SettingsField>
          </SettingsSection>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <SheetFooter className="mt-6 gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} data-testid="button-cancel-tour-operator">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isSubmitting || !form.name.trim()}
            data-testid="button-save-tour-operator"
          >
            {isSubmitting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {operator ? "Save changes" : "Create operator"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
