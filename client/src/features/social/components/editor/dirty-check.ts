export interface EditorSnapshot {
  post: string;
  schedule: string;
  /** Image selection fingerprint; null until images have finished loading. */
  images: string | null;
  /** Selected-accounts fingerprint; null until the account list has loaded. */
  accounts?: string | null;
}

/**
 * True when `next` differs from the loaded `prev` baseline. Never dirty while
 * there is no baseline (post still loading or not found).
 */
export function isDirtySnapshot(prev: EditorSnapshot | null, next: EditorSnapshot): boolean {
  if (!prev) return false;
  return (
    next.post !== prev.post ||
    next.schedule !== prev.schedule ||
    (prev.images !== null && next.images !== prev.images) ||
    (prev.accounts != null && next.accounts !== prev.accounts)
  );
}
