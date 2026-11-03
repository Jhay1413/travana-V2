/**
 * The most useful text for a failed ticket request: the server's own message
 * (for example "Holiday belongs to a different client"), else the Error
 * message, else the fallback. Generic transport messages are not shown.
 */
export function ticketErrorMessage(err: unknown, fallback: string): string {
  if (typeof err !== "object" || err === null) return fallback;
  const fromResponse = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
  if (typeof fromResponse === "string" && fromResponse.trim()) return fromResponse;
  const fromData = (err as { data?: { message?: unknown } }).data?.message;
  if (typeof fromData === "string" && fromData.trim()) return fromData;
  if (err instanceof Error && err.message && !/^Request failed with status code \d+$/.test(err.message) && err.message !== "Network Error") {
    return err.message;
  }
  return fallback;
}
