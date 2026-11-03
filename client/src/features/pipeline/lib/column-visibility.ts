export const COLUMN_PREVIEW_LIMIT = 4;

/** Which cards a column shows. Collapsed to its preview it shows the first
 *  `limit`; expanded it shows everything loaded. `hiddenCount` counts the deals
 *  the server holds that are not on screen (including pages not fetched yet). */
export function visibleColumnItems<T>(
  items: readonly T[],
  total: number,
  expanded: boolean,
  limit: number = COLUMN_PREVIEW_LIMIT,
): { visible: T[]; hiddenCount: number } {
  const visible = expanded ? [...items] : items.slice(0, limit);
  return { visible, hiddenCount: Math.max(0, Math.max(total, items.length) - visible.length) };
}
