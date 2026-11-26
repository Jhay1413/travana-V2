/**
 * Deals this customer has told the agent about in this browser session, so a card flips to "has been told" after a
 * successful tap even when the summary (which holds the server's own list) has not loaded or failed. Kept per
 * customer and forgotten on sign-out; always combined with the server's list, never instead of it.
 */
const toldByClient = new Map<string, Set<string>>();

/** The key for the signed-in customer (their id, or "" when it is not known). */
export function toldClientKey(stored: string | null): string {
  return stored ?? "";
}

export function toldThisSession(clientKey: string): ReadonlySet<string> {
  return new Set(toldByClient.get(clientKey) ?? []);
}

export function rememberTold(clientKey: string, dealId: string): void {
  const set = toldByClient.get(clientKey) ?? new Set<string>();
  set.add(dealId);
  toldByClient.set(clientKey, set);
}

export function clearToldThisSession(): void {
  toldByClient.clear();
}

/** Whether a deal shows as told: the server says so, or it was told in this session. */
export function isTold(dealId: string, serverTold: readonly string[], sessionTold: ReadonlySet<string>): boolean {
  return serverTold.includes(dealId) || sessionTold.has(dealId);
}
