/**
 * Tickets to list: everything once expanded; otherwise the first `max` plus any open ticket beyond them
 * (so unpinning an open card never makes it vanish). `hidden` is how many are still behind "Show more".
 */
export function visibleTickets<T extends { id: string }>(
  rows: readonly T[],
  expanded: boolean,
  max: number,
  isOpen: (id: string) => boolean,
): { shown: T[]; hidden: number } {
  const shown = expanded ? [...rows] : rows.filter((t, i) => i < max || isOpen(t.id));
  return { shown, hidden: rows.length - shown.length };
}
