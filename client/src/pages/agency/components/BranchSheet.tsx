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
import type { Branch, BranchOpeningHour, BranchOpeningPattern } from "@/api/endpoints/branch.api";
import {
  applyOpeningPattern,
  branchToForm,
  emptyBranchForm,
  OPENING_PATTERNS,
  type BranchFormState,
} from "../utils/branch-helpers";
import { OpeningHoursEditor } from "./OpeningHoursEditor";
import { SettingsField, SettingsSection, SettingsToggleRow } from "./SettingsField";

export function BranchSheet({
  open,
  branch,
  brandColor,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  branch: Branch | null;
  brandColor: string | null | undefined;
  onClose: () => void;
  onSubmit: (form: BranchFormState) => void;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<BranchFormState>(emptyBranchForm());

  useEffect(() => {
    if (!open) return;
    setForm(branch ? branchToForm(branch) : emptyBranchForm());
  }, [open, branch]);

  const updateField = <K extends keyof BranchFormState>(key: K, value: BranchFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateHour = (idx: number, patch: Partial<BranchOpeningHour>) =>
    setForm((prev) => ({
      ...prev,
      openingHours: prev.openingHours.map((h, i) => (i === idx ? { ...h, ...patch } : h)),
    }));

  const submit = () => {
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{branch ? "Edit branch" : "New branch"}</SheetTitle>
          <SheetDescription>
            {branch ? "Update this branch's details and opening hours." : "Add another branch to your agency."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <SettingsSection title="Basics">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <SettingsField label="Branch name" required>
                <Input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="High Street"
                  data-testid="input-branch-name"
                />
              </SettingsField>
              <SettingsField label="Code">
                <Input
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value.slice(0, 10))}
                  placeholder="HQ"
                  data-testid="input-branch-code"
                />
              </SettingsField>
            </div>
            <SettingsField label="Address">
              <Input
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="12 High St, London"
                data-testid="input-branch-address"
              />
            </SettingsField>
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsField label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="020 7123 4567"
                  data-testid="input-branch-phone"
                />
              </SettingsField>
              <SettingsField label="Email">
                <Input
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="branch@agency.com"
                  type="email"
                  data-testid="input-branch-email"
                />
              </SettingsField>
            </div>
          </SettingsSection>

          <SettingsSection title="Opening hours">
            <SettingsField label="Opening pattern">
              <select
                value={form.openingPattern}
                onChange={(e) => setForm((prev) => applyOpeningPattern(prev, e.target.value as BranchOpeningPattern))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                data-testid="select-branch-pattern"
              >
                {OPENING_PATTERNS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </SettingsField>

            <OpeningHoursEditor hours={form.openingHours} onChange={updateHour} />

            <SettingsToggleRow
              label="Open on bank holidays"
              description="If off, the branch is closed on UK bank holidays."
              checked={form.bankHolidaysOpen}
              onChange={(c) => updateField("bankHolidaysOpen", c)}
              testId="switch-bank-holidays"
            />
          </SettingsSection>

          <SettingsSection title="Status">
            <div className="space-y-2">
              <SettingsToggleRow
                label="Set as default branch"
                description="New members and clients without a branch are placed here."
                checked={form.isDefault}
                onChange={(c) => updateField("isDefault", c)}
                testId="switch-default"
              />
              <SettingsToggleRow
                label="Active"
                description="Archive a branch to hide it from pickers without deleting it."
                checked={form.isActive}
                onChange={(c) => updateField("isActive", c)}
                testId="switch-active"
              />
            </div>
          </SettingsSection>
        </div>

        <SheetFooter className="mt-8 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} data-testid="button-cancel-branch">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isSubmitting || !form.name.trim()}
            style={{ background: brandColor ?? undefined }}
            data-testid="button-save-branch"
          >
            {isSubmitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            {branch ? "Save changes" : "Create branch"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
