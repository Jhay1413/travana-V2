export interface PrevNext {
  /** Zero-based position in the order, or -1 when the ticket is not in it. */
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
}

/** Previous / next ticket ids through the current queue order. Not-in-order tickets get no neighbours. */
export function prevNext(orderIds: readonly string[], currentId: string): PrevNext {
  const index = orderIds.indexOf(currentId);
  if (index < 0) return { index: -1, total: orderIds.length, prevId: null, nextId: null };
  return {
    index,
    total: orderIds.length,
    prevId: index > 0 ? orderIds[index - 1] : null,
    nextId: index < orderIds.length - 1 ? orderIds[index + 1] : null,
  };
}
