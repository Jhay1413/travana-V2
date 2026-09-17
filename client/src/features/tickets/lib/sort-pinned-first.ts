/**
 * Non-mutating sort that moves pinned items to the front of the list.
 *
 * `pinnedAt` maps an item id to the time it was pinned (ms since epoch). The
 * pinned group is ordered most-recently-pinned first, so the ticket you just
 * pinned lands at the very top rather than somewhere among older pins. The
 * unpinned group keeps the caller's existing order. Apply this as the LAST
 * step after a list's own sort/filter so "pinned" is always the primary key.
 */
export function sortPinnedFirst<T extends { id: string }>(items: T[], pinnedAt: ReadonlyMap<string, number>): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    (pinnedAt.has(item.id) ? pinned : rest).push(item);
  }
  // Array.prototype.sort is stable, so equal pin times keep the caller's order.
  pinned.sort((a, b) => (pinnedAt.get(b.id) ?? 0) - (pinnedAt.get(a.id) ?? 0));
  return [...pinned, ...rest];
}
