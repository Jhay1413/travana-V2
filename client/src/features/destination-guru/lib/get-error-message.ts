// Narrows an unknown thrown/rejected value down to a displayable string
// without `any`. The axios interceptor (client/src/api/client/interceptors.ts)
// always rejects with an `Error` (optionally carrying extra `status`/`code`/
// `data` fields), so the `instanceof Error` check covers every request
// failure surfaced through this feature's mutations.
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
