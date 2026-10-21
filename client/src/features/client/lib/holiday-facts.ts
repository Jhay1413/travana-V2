import type { FieldRowSpec } from "@/features/client/components/holiday-fields";

export type FactRow = FieldRowSpec & { value: string };

/**
 * Merges the left/right field lists into one list for the two-column facts grid
 * (left, right, left, right, ...) and drops rows without a value. Trailing rows
 * of the longer list keep their order.
 */
export function factRows(fields: { left: FieldRowSpec[]; right: FieldRowSpec[] }): FactRow[] {
  const merged: FieldRowSpec[] = [];
  const longest = Math.max(fields.left.length, fields.right.length);
  for (let i = 0; i < longest; i += 1) {
    const l = fields.left[i];
    const r = fields.right[i];
    if (l) merged.push(l);
    if (r) merged.push(r);
  }
  return merged.filter((row): row is FactRow => Boolean(row.value));
}
