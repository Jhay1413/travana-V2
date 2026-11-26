/**
 * State that belongs to one thing (a customer, a quote). The value is stored with the key it was set for and is only ever
 * read back for that same key, so a hand-over panel or a channel pick made for customer A can never show up (or be sent)
 * while customer B is on screen, even when the page component stays mounted and only the id changes.
 */
export interface Held<T> {
  key: string;
  value: T;
}

export const hold = <T>(key: string, value: T): Held<T> => ({ key, value });

/** The held value if it was set for this key, otherwise null. */
export function heldFor<T>(held: Held<T> | null, key: string): T | null {
  return held !== null && held.key === key ? held.value : null;
}
