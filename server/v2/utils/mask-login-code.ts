/**
 * A one-time portal sign-in code rides in a link as `mt=<code>`. Anything that is stored for staff to read (the
 * sent-messages log) must not keep a live one, so the code is replaced before storing. The message that is
 * actually sent keeps the real link.
 */
export function maskLoginCodes(text: string): string {
  return text.replace(/([?&]mt=)[^&\s#]+/g, "$1[redacted]");
}
