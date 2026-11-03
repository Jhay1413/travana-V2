import { DEFAULT_BALANCE_WEEKS, OPERATOR_MESSAGES, normaliseWeb, operatorFieldsSchema, parseBalanceWeeks, parseCommission } from "@shared/tour-operator-rules";
import type { CreateOperatorPayload, OperatorFormErrors, OperatorFormField, OperatorFormValues, OrgOperatorRow, PatchOperatorPayload } from "../types";

/** A blank commission gets its own wording (the shared one covers "not a number"). */
export const BLANK_COMMISSION = "Enter the commission rate, e.g. 10.";

export function emptyForm(): OperatorFormValues {
  return { name: "", phone: "", web: "", username: "", password: "", commission: "", balanceWeeks: String(DEFAULT_BALANCE_WEEKS), isActive: true };
}

export function formFromRow(row: OrgOperatorRow): OperatorFormValues {
  const rate = row.commission_percentage;
  return {
    name: row.name,
    phone: row.phone ?? "",
    web: row.website ?? "",
    username: row.username ?? "",
    password: row.password ?? "",
    commission: rate === null || rate === "" ? "" : String(Number(rate)),
    balanceWeeks: String(row.balance_due_weeks),
    isActive: row.is_active,
  };
}

const FIELD_KEYS: OperatorFormField[] = ["name", "phone", "web", "username", "password", "commission", "balanceWeeks"];

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Field errors keyed by field; empty when the form is fine. `editingLinkId` skips the row being edited in the duplicate check. */
export function validateOperatorForm(
  values: OperatorFormValues,
  existing: Array<{ linkId: string; name: string }>,
  editingLinkId: string | null,
): OperatorFormErrors {
  const isEdit = editingLinkId !== null;
  const errors: OperatorFormErrors = {};
  const parsed = operatorFieldsSchema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key !== "string") continue;
      const field = FIELD_KEYS.find((f) => f === key);
      if (field && !errors[field]) errors[field] = issue.message;
    }
  }
  if (!values.commission.trim()) {
    // Required when adding; an imported row with no rate yet must stay editable.
    if (isEdit) delete errors.commission;
    else errors.commission = BLANK_COMMISSION;
  }
  if (!errors.name) {
    const dup = existing.find((e) => e.linkId !== editingLinkId && sameName(e.name, values.name));
    if (dup) errors.name = OPERATOR_MESSAGES.nameDuplicate(dup.name);
  }
  return errors;
}

export function hasErrors(errors: OperatorFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Create body. A catalogue pick sends its id; a typed name lets the server create or match it. Website and phone go either way. */
export function toCreatePayload(values: OperatorFormValues, catalogueId: string | null): CreateOperatorPayload {
  const website = normaliseWeb(values.web);
  const phone = values.phone.trim();
  return {
    commissionPercentage: parseCommission(values.commission).value ?? 0,
    balanceDueWeeks: parseBalanceWeeks(values.balanceWeeks).value ?? DEFAULT_BALANCE_WEEKS,
    ...(values.username.trim() ? { username: values.username.trim() } : {}),
    ...(values.password ? { password: values.password } : {}),
    ...(catalogueId ? { tourOperatorId: catalogueId } : { name: values.name.trim() }),
    ...(website ? { website } : {}),
    ...(phone ? { phone } : {}),
  };
}

/**
 * Patch body: only what the user changed. Untouched fields are never sent, so a
 * password that could not be shown is not wiped and shared catalogue fields
 * (name, website, phone) are not overwritten with a stale copy.
 */
export function toPatchPayload(values: OperatorFormValues, row: OrgOperatorRow): PatchOperatorPayload {
  const before = formFromRow(row);
  const out: PatchOperatorPayload = {};
  if (values.name.trim() !== before.name.trim()) out.name = values.name.trim();
  if (normaliseWeb(values.web) !== normaliseWeb(before.web)) out.website = normaliseWeb(values.web);
  if (values.phone.trim() !== before.phone.trim()) out.phone = values.phone.trim();
  if (values.username.trim() !== before.username.trim()) out.username = values.username.trim();
  if (values.password !== before.password) out.password = values.password;
  const rate = parseCommission(values.commission).value ?? null;
  if (rate !== (parseCommission(before.commission).value ?? null)) out.commissionPercentage = rate;
  const weeks = parseBalanceWeeks(values.balanceWeeks).value;
  if (weeks !== undefined && weeks !== row.balance_due_weeks) out.balanceDueWeeks = weeks;
  if (values.isActive !== before.isActive) out.isActive = values.isActive;
  return out;
}
