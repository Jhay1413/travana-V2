export interface EditorSnapshot {
  subtitle: string;
  post: string;
  schedule: string;
  /** Image selection fingerprint; null until images have finished loading. */
  images: string | null;
}

/**
 * True when `next` differs from the loaded `prev` baseline. Never dirty while
 * there is no baseline (post still loading or not found).
 */
export function isDirtySnapshot(prev: EditorSnapshot | null, next: EditorSnapshot): boolean {
  if (!prev) return false;
  return (
    next.subtitle !== prev.subtitle ||
    next.post !== prev.post ||
    next.schedule !== prev.schedule ||
    (prev.images !== null && next.images !== prev.images)
  );
}
