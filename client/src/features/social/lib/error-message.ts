/** Best human-readable message for a failed request: the server's `response.data.message`, else the Error message, else the fallback. */
export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === "string" && response.data.message) return response.data.message;
    if (err instanceof Error && err.message) return err.message;
  }
  return fallback;
}
