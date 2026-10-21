/** Moves `index` by `delta` within `count` items, wrapping at both ends. 0 when there are none. */
export function stepIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}
