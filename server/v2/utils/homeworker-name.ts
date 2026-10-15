/**
 * Placeholder branch name generated when a homeworker is invited without a
 * displayName. Both the invite (writer) and accept (replacer) sides derive it
 * from the email so a custom displayName is never overwritten.
 */
export function placeholderNameForEmail(email: string): string {
  const normalised = email.toLowerCase().trim();
  return normalised.split('@')[0] || normalised;
}
