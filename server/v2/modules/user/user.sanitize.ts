/** Columns that must never leave the server in an API response. */
const SECRET_FIELDS = [
  "password",
  "resetToken",
  "resetTokenExpiry",
  "inviteToken",
  "inviteTokenExpiry",
  "verificationToken",
  "verificationTokenExpiry",
] as const;

type SecretField = (typeof SECRET_FIELDS)[number];

export type SanitizedUser<T> = Omit<T, SecretField>;

/** Returns a copy of the user row without credentials or one-time tokens. */
export function sanitizeUser<T extends object>(user: T): SanitizedUser<T> {
  const copy: Record<string, unknown> = { ...(user as Record<string, unknown>) };
  for (const field of SECRET_FIELDS) delete copy[field];
  return copy as SanitizedUser<T>;
}
