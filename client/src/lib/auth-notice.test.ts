import { describe, expect, it } from "vitest";
import {
  AUTH_NOTICES,
  AUTH_NOTICE_KEY,
  clearAuthNotice,
  isAuthBlockCode,
  peekAuthNotice,
  writeAuthNotice,
  type NoticeStorage,
} from "./auth-notice";

function memoryStorage(): NoticeStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("auth-notice", () => {
  it("recognises only the two block codes", () => {
    expect(isAuthBlockCode("ACCOUNT_SUSPENDED")).toBe(true);
    expect(isAuthBlockCode("ACCOUNT_DEACTIVATED")).toBe(true);
    expect(isAuthBlockCode("SESSION_EXPIRED")).toBe(false);
    expect(isAuthBlockCode(undefined)).toBe(false);
  });

  it("stores a code and reads back its message without clearing it", () => {
    const s = memoryStorage();
    writeAuthNotice(s, "ACCOUNT_SUSPENDED");
    expect(peekAuthNotice(s)).toBe(AUTH_NOTICES.ACCOUNT_SUSPENDED);
    expect(peekAuthNotice(s)).toBe(AUTH_NOTICES.ACCOUNT_SUSPENDED);
  });

  it("clears the notice so it shows once", () => {
    const s = memoryStorage();
    writeAuthNotice(s, "ACCOUNT_DEACTIVATED");
    clearAuthNotice(s);
    expect(peekAuthNotice(s)).toBeNull();
  });

  it("ignores unknown codes and tampered values", () => {
    const s = memoryStorage();
    writeAuthNotice(s, "OTHER");
    expect(s.data.size).toBe(0);
    s.setItem(AUTH_NOTICE_KEY, "<script>");
    expect(peekAuthNotice(s)).toBeNull();
  });

  it("copes with missing or throwing storage", () => {
    expect(peekAuthNotice(null)).toBeNull();
    expect(() => writeAuthNotice(undefined, "ACCOUNT_SUSPENDED")).not.toThrow();
    const broken: NoticeStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(() => writeAuthNotice(broken, "ACCOUNT_SUSPENDED")).not.toThrow();
    expect(peekAuthNotice(broken)).toBeNull();
    expect(() => clearAuthNotice(broken)).not.toThrow();
  });
});
