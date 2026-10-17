import type { ShopResult } from "../types";

export const NOT_PENDING_CODE = "ONBOARDING_NOT_PENDING";

/**
 * True when a setup write was refused because onboarding is already complete (409 + code).
 * The axios interceptor copies the body's `code` onto the thrown error (and keeps the body on `data`).
 */
export function isNotPendingError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { status?: unknown; code?: unknown; data?: { code?: unknown }; response?: { status?: unknown; data?: { code?: unknown } } };
  const status = e.status ?? e.response?.status;
  const code = e.code ?? e.data?.code ?? e.response?.data?.code;
  return status === 409 && code === NOT_PENDING_CODE;
}

/** True when POST /shops reported the not-pending refusal on any row. */
export function shopResultsNotPending(results: Pick<ShopResult, "code">[]): boolean {
  return results.some((r) => r.code === NOT_PENDING_CODE);
}
