import type { SortKey } from "./sort";

export interface SortPreference {
  key: SortKey;
  unreadFirst: boolean;
  remember: boolean;
}

export const SORT_PREFERENCE_STORAGE_KEY = "travana.inbox.sort";

export const DEFAULT_SORT_PREFERENCE: SortPreference = { key: "latest", unreadFirst: false, remember: false };

const KEYS: SortKey[] = ["latest", "longest_waiting", "unread_first", "name"];

export function readSortPreference(storage: Pick<Storage, "getItem">): SortPreference {
  try {
    const raw = storage.getItem(SORT_PREFERENCE_STORAGE_KEY);
    if (!raw) return DEFAULT_SORT_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<SortPreference> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_SORT_PREFERENCE;
    const key = KEYS.includes(parsed.key as SortKey) ? (parsed.key as SortKey) : DEFAULT_SORT_PREFERENCE.key;
    // A stored value only exists when the user chose to remember it.
    return { key, unreadFirst: parsed.unreadFirst === true, remember: true };
  } catch {
    return DEFAULT_SORT_PREFERENCE;
  }
}

export function writeSortPreference(storage: Pick<Storage, "setItem" | "removeItem">, pref: SortPreference): void {
  try {
    if (pref.remember) storage.setItem(SORT_PREFERENCE_STORAGE_KEY, JSON.stringify(pref));
    else storage.removeItem(SORT_PREFERENCE_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode or quota): the preference just is not persisted.
  }
}
