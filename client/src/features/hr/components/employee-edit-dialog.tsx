import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { useUpdateHrEmployee } from "@/hooks/mutations";
import {
  type EmployeeRow as ApiEmployeeRow,
  type HrStatus as ApiHrStatus,
  type EmploymentType as ApiEmploymentType,
  type ContractType as ApiContractType,
} from "@/features/hr/api/hr.api";
import { toIsoDate, STATUS_OPTIONS, EMPLOYMENT_OPTIONS, CONTRACT_OPTIONS } from "./helpers";

export function EmployeeEditDialog({
  open, employee, onClose,
}: {
  open: boolean;
  employee: ApiEmployeeRow | null;
  onClose: (changed: boolean) => void;
}) {
  const { orgRole } = useRole();
  const { toast } = useToast();
  const canSeeSensitive = orgRole === "org_admin" || orgRole === "platform_admin";

  const [form, setForm] = useState(() => ({
    status:           employee?.status          ?? "Active" as ApiHrStatus,
    employmentType:   employee?.employmentType  ?? "Full-time" as ApiEmploymentType,
    startDate:        toIsoDate(employee?.startDate),
    probationEnd:     toIsoDate(employee?.probationEnd),
    contractType:     (employee?.contractType ?? "") as ApiContractType | "",
    contractEndDate:  toIsoDate(employee?.contractEndDate),
    holidayAllowance: employee?.holidayAllowance ?? 0,
    salary:           employee?.salary ?? "",
    salaryCurrency:   employee?.salaryCurrency ?? "GBP",
    taxId:            employee?.taxId ?? "",
  }));

  // Reset form when employee changes (drawer opens for a different person)
  useMemo(() => {
    if (!employee) return;
    setForm({
      status:           employee.status,
      employmentType:   employee.employmentType,
      startDate:        toIsoDate(employee.startDate),
      probationEnd:     toIsoDate(employee.probationEnd),
      contractType:     (employee.contractType ?? "") as ApiContractType | "",
      contractEndDate:  toIsoDate(employee.contractEndDate),
      holidayAllowance: employee.holidayAllowance ?? 0,
      salary:           employee.salary ?? "",
      salaryCurrency:   employee.salaryCurrency ?? "GBP",
      taxId:            employee.taxId ?? "",
    });
  }, [employee?.userId]);

  const save = useUpdateHrEmployee();

  const handleSave = () => {
    if (!employee) return;
    save.mutate(
      {
        userId: employee.userId,
        input: {
          status: form.status,
          employmentType: form.employmentType,
          startDate: form.startDate || null,
          probationEnd: form.probationEnd || null,
          contractType: (form.contractType || null) as ApiContractType | null,
          contractEndDate: form.contractEndDate || null,
          holidayAllowance: Number.isFinite(form.holidayAllowance) ? form.holidayAllowance : null,
          ...(canSeeSensitive ? {
            salary: form.salary || null,
            salaryCurrency: form.salaryCurrency || null,
            taxId: form.taxId || null,
          } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Saved", description: "Employee details updated." });
          onClose(true);
        },
        onError: (err: any) => {
          toast({
            title: "Save failed",
            description: err?.response?.data?.message ?? "Could not update employee.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(false)}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {employee.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Status"
              value={form.status} options={STATUS_OPTIONS}
              onChange={(v) => setForm((f) => ({ ...f, status: v as ApiHrStatus }))}
              testId="select-edit-status" />
            <SelectField label="Employment type"
              value={form.employmentType} options={EMPLOYMENT_OPTIONS}
              onChange={(v) => setForm((f) => ({ ...f, employmentType: v as ApiEmploymentType }))}
              testId="select-edit-employment-type" />
            <DateField label="Start date"
              value={form.startDate}
              onChange={(v) => setForm((f) => ({ ...f, startDate: v }))}
              testId="input-edit-start-date" />
            <DateField label="Probation end"
              value={form.probationEnd}
              onChange={(v) => setForm((f) => ({ ...f, probationEnd: v }))}
              testId="input-edit-probation-end" />
            <SelectField label="Contract type"
              value={form.contractType || ""}
              options={["", ...CONTRACT_OPTIONS]}
              onChange={(v) => setForm((f) => ({ ...f, contractType: v as ApiContractType | "" }))}
              testId="select-edit-contract-type" />
            <DateField label="Contract end"
              value={form.contractEndDate}
              onChange={(v) => setForm((f) => ({ ...f, contractEndDate: v }))}
              testId="input-edit-contract-end" />
            <NumberField label="Holiday allowance (days/year)"
              value={form.holidayAllowance}
              onChange={(v) => setForm((f) => ({ ...f, holidayAllowance: v }))}
              testId="input-edit-holiday-allowance" />
          </div>

          {canSeeSensitive && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 space-y-3">
              <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                Sensitive — admin only
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Salary</Label>
                  <Input value={form.salary}
                    onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                    placeholder="35000.00" inputMode="decimal"
                    data-testid="input-edit-salary" />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={form.salaryCurrency}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, salaryCurrency: e.target.value.toUpperCase().slice(0, 3) }))}
                    placeholder="GBP"
                    data-testid="input-edit-currency" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Tax / NI number</Label>
                  <Input value={form.taxId}
                    onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                    placeholder="QQ123456C"
                    data-testid="input-edit-tax-id" />
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={save.isPending} data-testid="button-save-employee">
            {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SelectField({ label, value, options, onChange, testId }: {
  label: string; value: string; options: readonly string[];
  onChange: (v: string) => void; testId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        data-testid={testId}>
        {options.map((o) => <option key={o || "_blank"} value={o}>{o || "—"}</option>)}
      </select>
    </div>
  );
}

export function DateField({ label, value, onChange, testId }: {
  label: string; value: string; onChange: (v: string) => void; testId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <DatePicker value={value} onChange={onChange} className="h-9 rounded-md" data-testid={testId} />
    </div>
  );
}

export function NumberField({ label, value, onChange, testId }: {
  label: string; value: number; onChange: (v: number) => void; testId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min={0} value={value}
        onChange={(e) => onChange(Number(e.target.value))} data-testid={testId} />
    </div>
  );
}
