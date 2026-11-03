import { describe, expect, it } from "vitest";
import { DEFAULT_SORT_PREFERENCE, readSortPreference, writeSortPreference } from "./sort-preference";

function fake() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("sort preference", () => {
  it("defaults when empty or corrupt", () => {
    const s = fake();
    expect(readSortPreference(s)).toEqual(DEFAULT_SORT_PREFERENCE);
    s.m.set("travana.inbox.sort", "{nope");
    expect(readSortPreference(s)).toEqual(DEFAULT_SORT_PREFERENCE);
  });
  it("round-trips when remember is true", () => {
    const s = fake();
    writeSortPreference(s, { key: "name", unreadFirst: true, remember: true });
    expect(readSortPreference(s)).toEqual({ key: "name", unreadFirst: true, remember: true });
  });
  it("removes when remember is false", () => {
    const s = fake();
    writeSortPreference(s, { key: "name", unreadFirst: true, remember: true });
    writeSortPreference(s, { key: "name", unreadFirst: true, remember: false });
    expect(s.m.size).toBe(0);
  });
  it("falls back for an invalid key", () => {
    const s = fake();
    s.m.set("travana.inbox.sort", JSON.stringify({ key: "bogus", unreadFirst: true }));
    expect(readSortPreference(s).key).toBe("latest");
  });
});
