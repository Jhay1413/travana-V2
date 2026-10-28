import type { ImageItem } from "./editor.types";

/** Anything with a stable key can be ordered. */
interface Keyed {
  sortKey: string;
}

/**
 * Keeps the remembered order for items that are still present, drops the ones that
 * went away and appends new ones at the end (so selecting an image appends it and
 * deselecting removes it).
 */
export function reconcileOrder(prev: readonly string[], present: readonly string[]): string[] {
  const live = new Set(present);
  const kept = prev.filter((key) => live.has(key));
  const known = new Set(kept);
  return [...kept, ...present.filter((key) => !known.has(key))];
}

/** Sorts `items` by `keys`; items with no remembered position go last, in their given order. */
export function applyOrder<T extends Keyed>(items: readonly T[], keys: readonly string[]): T[] {
  const position = new Map(keys.map((key, i) => [key, i]));
  const known = items.filter((item) => position.has(item.sortKey)).sort((a, b) => position.get(a.sortKey)! - position.get(b.sortKey)!);
  return [...known, ...items.filter((item) => !position.has(item.sortKey))];
}

/** Moves `key` one step earlier (-1) or later (1); unchanged at either end. */
export function moveKey(keys: readonly string[], key: string, direction: -1 | 1): string[] {
  const from = keys.indexOf(key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= keys.length) return [...keys];
  const next = [...keys];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Drops `fromKey` onto `toKey`: it takes the target's position and the rest shift along. */
export function insertKeyAt(keys: readonly string[], fromKey: string, toKey: string): string[] {
  const from = keys.indexOf(fromKey);
  const to = keys.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) return [...keys];
  const next = [...keys];
  next.splice(from, 1);
  next.splice(to, 0, fromKey);
  return next;
}

export function appendKey(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? [...keys] : [...keys, key];
}

export function removeKey(keys: readonly string[], key: string): string[] {
  return keys.filter((k) => k !== key);
}

export interface OrderedUpload {
  existingIds: number[];
  urls: string[];
  files: File[];
  /** `existing:<mediaId>`, `url:<index into urls>` or `file:<index into files>`, in post order. */
  tokens: string[];
}

/** Splits the ordered list into the three multipart lists plus the one token list that ties them together. */
export function buildOrderedUpload(items: readonly ImageItem[]): OrderedUpload {
  const out: OrderedUpload = { existingIds: [], urls: [], files: [], tokens: [] };
  for (const item of items) {
    if (item.type === "existing") {
      out.tokens.push(`existing:${item.data.id}`);
      out.existingIds.push(item.data.id);
    } else if (item.type === "url") {
      out.tokens.push(`url:${out.urls.length}`);
      out.urls.push(item.data.url);
    } else {
      out.tokens.push(`file:${out.files.length}`);
      out.files.push(item.data.file);
    }
  }
  return out;
}

/** Parses one wire token back into its kind and number; null when malformed. */
export function parseOrderToken(token: string): { kind: "existing" | "url" | "file"; n: number } | null {
  const match = /^(existing|url|file):(\d+)$/.exec(token);
  return match ? { kind: match[1] as "existing" | "url" | "file", n: Number(match[2]) } : null;
}

/** Keeps the first occurrence of each url, so sort keys derived from the url stay unique. */
export function dedupeByUrl<T extends { url: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
