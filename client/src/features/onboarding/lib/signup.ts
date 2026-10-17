/** Whether the verification email went out. Missing or odd responses count as sent (the old behaviour). */
export function readEmailSent(body: unknown): boolean {
  if (!body || typeof body !== "object") return true;
  const b = body as { emailSent?: unknown; data?: { emailSent?: unknown } | null };
  const v = b.emailSent ?? b.data?.emailSent;
  return typeof v === "boolean" ? v : true;
}
