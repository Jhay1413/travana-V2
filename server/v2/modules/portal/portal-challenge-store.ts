// Best-effort, in-memory single-use record of WebAuthn challenge ids. The signed
// challenge token is the real guard (2 min lifetime); this additionally stops a
// challenge being replayed on the same server instance. It is per-process, so
// across several instances the short token lifetime is what limits replay.

const consumed = new Map<string, number>();

/**
 * Marks a challenge id as used. Returns false when it was already used.
 * `expiresAtSeconds` is the token's `exp`, after which the record is dropped.
 */
export function consumeChallenge(jti: string, expiresAtSeconds: number, nowMs: number = Date.now()): boolean {
  for (const [id, expiresAt] of consumed) {
    if (expiresAt * 1000 <= nowMs) consumed.delete(id);
  }
  if (consumed.has(jti)) return false;
  consumed.set(jti, expiresAtSeconds);
  return true;
}

/** Test helper. */
export function resetChallengeStore(): void {
  consumed.clear();
}
