import type { TourOperator } from "../types";

export const UNLISTED_OPERATOR_LABEL = "Unlisted operator";

export interface OperatorOption {
  value: string;
  label: string;
}

export function findOperator(
  list: readonly TourOperator[] | undefined,
  id: string | null | undefined,
): TourOperator | undefined {
  if (!id || !list) return undefined;
  return list.find((op) => op.id === id);
}

/**
 * Select options: every active link, plus the currently selected operator even when it is
 * inactive, plus a synthetic entry when the selected operator is not in the agency's list.
 */
export function operatorSelectOptions(
  list: readonly TourOperator[] | undefined,
  selectedId?: string | null,
  selectedName?: string | null,
): OperatorOption[] {
  // List still loading (or unavailable, e.g. 403): never label the saved operator "Unlisted".
  if (!list) return selectedId && selectedName ? [{ value: selectedId, label: selectedName }] : [];
  const operators = list;
  const options: OperatorOption[] = operators
    .filter((op) => op.is_active || op.id === selectedId)
    .map((op) => ({ value: op.id, label: op.name ?? "" }));

  if (selectedId && !operators.some((op) => op.id === selectedId)) {
    options.push({ value: selectedId, label: selectedName || UNLISTED_OPERATOR_LABEL });
  }
  return options;
}
