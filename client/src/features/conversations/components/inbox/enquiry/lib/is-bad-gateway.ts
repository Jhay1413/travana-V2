/**
 * The axios interceptor rejects with an `Error` carrying `.status`, not an
 * axios-style `.response`. A 502 means the AI service is unavailable.
 */
export function isBadGateway(err: unknown): boolean {
  return (err as { status?: number } | null)?.status === 502;
}
