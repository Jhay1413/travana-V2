// The board-basis types shown first in board-basis dropdowns across the app,
// in this exact order. Everything else in the lookup stays available after
// them (searchable dropdowns let an agent type to find any of the rest) —
// nothing is ever removed from the list.
export const PINNED_BOARD_BASIS_TYPES = [
  "Room Only",
  "Self Catering",
  "Bed and Breakfast",
  "Half Board",
  "Full Board",
  "All Inclusive",
  "All Inclusive Plus",
] as const;

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

/**
 * Reorders board-basis rows so the `PINNED_BOARD_BASIS_TYPES` lead, in that
 * order, followed by the remaining rows in their existing order (the lookup
 * API already returns them alphabetically by `type`). Matching is
 * case-insensitive and trims whitespace so minor formatting differences
 * (e.g. a trailing space) don't stop a row from being pinned; a pinned name
 * that isn't present in the current environment's lookup data is simply
 * skipped, and nothing is ever dropped from the result.
 */
export function orderBoardBasisRows<T extends { type: string | null }>(rows: T[]): T[] {
  const rest = [...rows];
  const pinned: T[] = [];
  for (const wanted of PINNED_BOARD_BASIS_TYPES) {
    const idx = rest.findIndex((r) => normalize(r.type) === normalize(wanted));
    if (idx !== -1) pinned.push(...rest.splice(idx, 1));
  }
  return [...pinned, ...rest];
}
