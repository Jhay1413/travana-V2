/** Rows to render: the first `max` while collapsed, every row once expanded. */
export function visibleRows<T>(rows: readonly T[], expanded: boolean, max: number): T[] {
  return expanded ? [...rows] : rows.slice(0, max);
}
