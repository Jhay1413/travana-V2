export type AuthBlockCode = "ACCOUNT_SUSPENDED" | "ACCOUNT_DEACTIVATED";

/** The slice of Storage this module needs, so tests can pass a plain object. */
export interface NoticeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const AUTH_NOTICE_KEY = "travana:auth-notice";

export const AUTH_NOTICES: Record<AuthBlockCode, string> = {
  ACCOUNT_SUSPENDED: "Your account has been suspended. Contact your agency admin.",
  ACCOUNT_DEACTIVATED: "Your account has been deactivated. Contact your agency admin.",
};

export function isAuthBlockCode(value: unknown): value is AuthBlockCode {
  return value === "ACCOUNT_SUSPENDED" || value === "ACCOUNT_DEACTIVATED";
}

/** Remember why the session ended, so the sign-in page can say so after the soft re-auth. Unknown codes are ignored. */
export function writeAuthNotice(storage: NoticeStorage | null | undefined, code: unknown): void {
  if (!storage || !isAuthBlockCode(code)) return;
  try {
    storage.setItem(AUTH_NOTICE_KEY, code);
  } catch {
    // Storage can be full or blocked; the notice is a courtesy, never required.
  }
}

/** The stored notice text, if any, without clearing it. */
export function peekAuthNotice(storage: NoticeStorage | null | undefined): string | null {
  if (!storage) return null;
  try {
    const code = storage.getItem(AUTH_NOTICE_KEY);
    return isAuthBlockCode(code) ? AUTH_NOTICES[code] : null;
  } catch {
    return null;
  }
}

export function clearAuthNotice(storage: NoticeStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(AUTH_NOTICE_KEY);
  } catch {
    // Nothing to clear.
  }
}
