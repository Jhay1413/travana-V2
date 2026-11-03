import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { emptyForm, hasErrors, validateOperatorForm } from "../lib/form-validation";
import type { OperatorFormErrors, OperatorFormField, OperatorFormValues } from "../types";
import { CatalogueNameInput } from "./catalogue-name-input";
import { FIELD_INPUT } from "./classes";

interface OperatorFormProps {
  /** Add: catalogue autocomplete, "Add tour operator". Edit: inline row, Escape cancels, Inactive switch. */
  mode: "add" | "edit";
  idPrefix: string;
  initial?: OperatorFormValues;
  existing: Array<{ linkId: string; name: string }>;
  editingLinkId?: string | null;
  busy: boolean;
  stacked?: boolean;
  onSubmit: (values: OperatorFormValues, catalogueId: string | null) => void;
  onCancel: () => void;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-semibold text-social-muted">
        {label}
      </label>
      {children}
      {error && (
        <span id={`${id}-e`} role="alert" className="text-[12px] font-medium text-status-failed-fg">
          {error}
        </span>
      )}
    </div>
  );
}

/** The seven-field form used for both "Add a tour operator" and the inline edit row. */
export function OperatorForm({ mode, idPrefix, initial, existing, editingLinkId = null, busy, stacked, onSubmit, onCancel }: OperatorFormProps) {
  const editing = mode === "edit";
  const [values, setValues] = useState<OperatorFormValues>(initial ?? emptyForm());
  const [errors, setErrors] = useState<OperatorFormErrors>({});
  const [catalogue, setCatalogue] = useState<{ id: string; name: string } | null>(null);

  const set = (key: OperatorFormField) => (v: string) => setValues((cur) => ({ ...cur, [key]: v }));
  const fid = (key: OperatorFormField) => `${idPrefix}-${key}`;
  const inputProps = (key: OperatorFormField, extra: { placeholder?: string; mode?: "decimal" | "numeric" | "tel" } = {}) => ({
    id: fid(key),
    value: values[key],
    onChange: (e: { target: { value: string } }) => set(key)(e.target.value),
    placeholder: extra.placeholder,
    inputMode: extra.mode,
    className: FIELD_INPUT,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${fid(key)}-e` : undefined,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateOperatorForm(values, existing, editingLinkId);
    setErrors(found);
    if (hasErrors(found)) {
      const first = (Object.keys(found) as OperatorFormField[])[0];
      if (first) document.getElementById(fid(first))?.focus();
      return;
    }
    // The pick only counts while the name still matches it.
    const pickedId = catalogue && catalogue.name.trim().toLowerCase() === values.name.trim().toLowerCase() ? catalogue.id : null;
    onSubmit(values, pickedId);
  }

  const label = editing ? `Edit ${initial?.name ?? "tour operator"}` : "Add a tour operator";

  return (
    <form
      noValidate
      aria-label={label}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && editing) onCancel();
      }}
      className={cn("flex flex-col gap-3", !editing && "rounded-[14px] border border-social-border bg-social-page p-4")}
      data-testid={editing ? "operator-edit-form" : "operator-add-form"}
    >
      {!editing && <b className="text-[14px] font-semibold">Add a tour operator</b>}
      <div className={cn("grid gap-x-3 gap-y-2.5 grid-cols-1", !stacked && "min-[901px]:grid-cols-4 min-[1281px]:grid-cols-7")}>
        <Field id={fid("name")} label="Tour Operator" error={errors.name}>
          {editing ? (
            <input {...inputProps("name", { placeholder: "e.g. TUI" })} autoFocus />
          ) : (
            <CatalogueNameInput
              id={fid("name")}
              value={values.name}
              invalid={!!errors.name}
              describedBy={errors.name ? `${fid("name")}-e` : undefined}
              autoFocus
              onChange={set("name")}
              onPick={(row) => {
                setCatalogue({ id: row.id, name: row.name });
                setValues((cur) => ({ ...cur, name: row.name, web: row.website ?? "", phone: row.phone ?? "" }));
              }}
            />
          )}
        </Field>
        <Field id={fid("phone")} label="Phone" error={errors.phone}>
          <input {...inputProps("phone", { placeholder: "0203 451 2720", mode: "tel" })} type="tel" />
        </Field>
        <Field id={fid("web")} label="Weblink" error={errors.web}>
          <input {...inputProps("web", { placeholder: "trade.example.com" })} />
        </Field>
        <Field id={fid("username")} label="Username" error={errors.username}>
          <input {...inputProps("username")} autoComplete="off" />
        </Field>
        <Field id={fid("password")} label="Password" error={errors.password}>
          <input {...inputProps("password")} autoComplete="off" />
        </Field>
        <Field id={fid("commission")} label="Commission Rate (%)" error={errors.commission}>
          <input {...inputProps("commission", { placeholder: "10", mode: "decimal" })} />
        </Field>
        <Field id={fid("balanceWeeks")} label="Balance Due (weeks)" error={errors.balanceWeeks}>
          <input {...inputProps("balanceWeeks", { placeholder: "14", mode: "numeric" })} />
        </Field>
      </div>
      {editing && (
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <Switch checked={values.isActive} onCheckedChange={(v) => setValues((cur) => ({ ...cur, isActive: v }))} aria-label="Active" />
          {values.isActive ? "Active" : "Inactive"}
          <span className="text-[12px] font-normal text-social-muted">Inactive operators stay on old quotes but are hidden from new ones.</span>
        </label>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-9 px-3 text-[12px]")} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy} className={cn(PRIMARY_ACTION, "h-9 px-4 text-[13px]")} data-testid={editing ? "button-save-operator" : "button-submit-operator"}>
          {editing ? "Save changes" : "Add tour operator"}
        </Button>
      </div>
    </form>
  );
}
